// ── VERCEL SERVERLESS FUNCTION: INBOUND EMAIL REPLY HANDLER ──
// Path: api/inbound-email.js
//
// Resend calls this whenever an email arrives at your inbound receiving
// domain (see setup notes at the bottom of this file). Flow:
//   1. Verify the request genuinely came from Resend (Svix HMAC signature).
//   2. The webhook payload only has metadata — fetch the full body via
//      Resend's Receiving API using the email_id.
//   3. Try to match the sender against an existing buyer/supplier.
//   4. Ask Claude to draft a reply.
//   5. Insert the draft into the SAME `queue` table Message Approvals reads
//      from — so it shows up for you to review/approve exactly like any
//      other AI-drafted message, and sends through your existing
//      /api/send-email relay (which already injects the verify link).
//
// Required Vercel Environment Variables (Project → Settings → Environment
// Variables) — none of these should ever be exposed to the browser:
//   SUPABASE_URL                 — same project URL used in src/lib/supabase.js
//   SUPABASE_SERVICE_ROLE_KEY    — Supabase → Settings → API → service_role key
//   RESEND_WEBHOOK_SECRET        — from Resend when you create the webhook (whsec_...)
//   ANTHROPIC_API_KEY            — same key used by api/claude.js
//   INBOUND_OWNER_USER_ID        — your Supabase auth user id (single-tenant app)
//
// This must run with the raw request body available (needed for signature
// verification), so automatic body parsing is disabled below.

import crypto from "crypto";

export const config = {
  api: { bodyParser: false },
};

const COMPANY_PROFILE_URL =
  process.env.COMPANY_PROFILE_URL || "https://e-broker.vercel.app/company";
const CIPC_REG_NO = process.env.CIPC_REG_NO || "2026/565924/07";

function ensureVerifyLink(body) {
  const safeBody = typeof body === "string" ? body : "";
  if (safeBody.includes(COMPANY_PROFILE_URL)) return safeBody;
  return `${safeBody}\n\n—\nVerify our company registration (CIPC ${CIPC_REG_NO}): ${COMPANY_PROFILE_URL}`;
}

// Reads the raw request body as a string (required before any JSON parsing,
// since signature verification is computed over the exact original bytes).
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

// Verifies a Resend/Svix webhook signature using Node's built-in crypto —
// deliberately dependency-free so this doesn't risk a broken build from a
// missing package. Returns true/false.
function verifySvixSignature({ id, timestamp, signature, body, secret }) {
  if (!id || !timestamp || !signature || !secret) return false;
  try {
    // Svix secrets are prefixed "whsec_" followed by base64 data.
    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const signedContent = `${id}.${timestamp}.${body}`;
    const expected = crypto
      .createHmac("sha256", secretBytes)
      .update(signedContent)
      .digest("base64");

    // svix-signature header can contain multiple space-separated "v1,<sig>"
    // values (for secret rotation) — match against any of them.
    const candidates = signature
      .split(" ")
      .map((part) => part.split(",")[1])
      .filter(Boolean);

    return candidates.some((candidate) => {
      try {
        return crypto.timingSafeEqual(
          Buffer.from(candidate, "base64"),
          Buffer.from(expected, "base64")
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const rawBody = await readRawBody(req);

  const svixId = req.headers["svix-id"];
  const svixTimestamp = req.headers["svix-timestamp"];
  const svixSignature = req.headers["svix-signature"];
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  const isValid = verifySvixSignature({
    id: svixId,
    timestamp: svixTimestamp,
    signature: svixSignature,
    body: rawBody,
    secret: webhookSecret,
  });

  if (!isValid) {
    // Do not process anything from an unverified request — this endpoint
    // has no user auth of its own, so signature verification is the only
    // thing standing between it and anyone on the internet who finds the URL.
    return res.status(401).json({ error: "Invalid webhook signature." });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload." });
  }

  // Only act on inbound mail. Resend sends other event types (email.sent,
  // email.delivered, email.bounced, etc.) to the same webhook if you
  // subscribe to them — acknowledge and ignore anything that isn't a
  // received message.
  if (event?.type !== "email.received") {
    return res.status(200).json({ ok: true, ignored: event?.type || "unknown" });
  }

  const ownerUserId = process.env.INBOUND_OWNER_USER_ID;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!ownerUserId || !supabaseUrl || !serviceKey) {
    console.error("inbound-email: missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or INBOUND_OWNER_USER_ID env vars");
    return res.status(500).json({ error: "Server misconfigured." });
  }

  const sbHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const emailId = event.data?.email_id;
  const fromAddr = (event.data?.from || "").trim();
  const subject = event.data?.subject || "(no subject)";

  if (!emailId || !fromAddr) {
    return res.status(400).json({ error: "Payload missing email_id or from address." });
  }

  try {
    // ── 1. Fetch the profile (for resend_key, from_email, signoff, focus) ──
    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${ownerUserId}&select=*`,
      { headers: sbHeaders }
    );
    const profiles = await profileRes.json().catch(() => []);
    const profile = Array.isArray(profiles) ? profiles[0] : null;

    if (!profile?.resend_key) {
      console.error("inbound-email: owner profile missing resend_key, cannot fetch full email body");
      return res.status(500).json({ error: "Owner profile not configured with a Resend key." });
    }

    // ── 2. Fetch the full email body via Resend's Receiving API ──
    // (the webhook payload itself only contains metadata, not the content)
    const bodyRes = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${profile.resend_key}` },
    });
    const fullEmail = await bodyRes.json().catch(() => ({}));
    const incomingText = fullEmail?.text || fullEmail?.html?.replace(/<[^>]+>/g, " ") || "";

    // ── 3. Try to match the sender against an existing buyer/supplier ──
    const [buyerRes, supplierRes] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/buyers?user_id=eq.${ownerUserId}&email=eq.${encodeURIComponent(fromAddr)}&select=*`,
        { headers: sbHeaders }
      ),
      fetch(
        `${supabaseUrl}/rest/v1/suppliers?user_id=eq.${ownerUserId}&email=eq.${encodeURIComponent(fromAddr)}&select=*`,
        { headers: sbHeaders }
      ),
    ]);
    const buyers = await buyerRes.json().catch(() => []);
    const suppliers = await supplierRes.json().catch(() => []);
    const matchedBuyer = Array.isArray(buyers) ? buyers[0] : null;
    const matchedSupplier = Array.isArray(suppliers) ? suppliers[0] : null;
    const matched = matchedBuyer || matchedSupplier;
    const matchedKind = matchedBuyer ? "buyer" : matchedSupplier ? "supplier" : null;

    // ── 4. Store the inbound message for audit/history regardless of what happens next ──
    await fetch(`${supabaseUrl}/rest/v1/inbound`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: ownerUserId,
        email_id: emailId,
        from_addr: fromAddr,
        subject,
        body_text: incomingText.slice(0, 5000),
        matched_contact_id: matched?.id || null,
        matched_contact_kind: matchedKind,
        drafted_reply: false,
      }),
    });

    // ── 5. Respect Do Not Contact — no auto-draft for DNC'd contacts ──
    if (matched?.dnc) {
      await fetch(`${supabaseUrl}/rest/v1/feed`, {
        method: "POST",
        headers: { ...sbHeaders, Prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: ownerUserId,
          text: `📥 Reply received from ${matched.name} (${fromAddr}) — marked Do Not Contact, no auto-draft generated. Reply manually if needed.`,
          color: "#f59e0b",
        }),
      });
      return res.status(200).json({ ok: true, skipped: "dnc" });
    }

    // ── 6. Draft a reply with Claude ──
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    let draftedSubject = `Re: ${subject}`;
    let draftedBody = "";

    if (anthropicKey && incomingText.trim()) {
      const contactContext = matched
        ? `They are a known ${matchedKind} contact: ${matched.name}, ${matched.country || ""}, ${matchedKind === "supplier" ? matched.product : matched.industry}.`
        : `They are not yet a saved contact in the system — this may be a new inbound enquiry.`;

      const sys =
        "You are Reply AI for a trade broker. Draft a concise, professional written reply to an inbound email from a business contact. " +
        "Written only — no calls/meetings. No profit guarantees. Sign off with the broker's sign-off. " +
        "Address what they actually asked or said — do not write a generic template. Under 150 words. Return ONLY JSON: { \"subject\": \"\", \"body\": \"\" }";

      const prompt =
        `Incoming email from ${fromAddr}, subject "${subject}":\n\n"""${incomingText.slice(0, 3000)}"""\n\n` +
        `${contactContext} Broker focus: ${profile.focus || "bulk trade"}. Sign off: "${profile.signoff || "Trade Operations"}". ` +
        `Draft a reply. Return JSON: { "subject": "", "body": "" }`;

      try {
        const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 600,
            system: sys,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        const claudeData = await claudeRes.json().catch(() => ({}));
        const text = (claudeData.content || [])
          .filter((b) => b.type === "text")
          .map((b) => b.text || "")
          .join("\n");

        let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
        const firstBrace = cleaned.search(/[{[]/);
        if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
        const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
        if (lastBrace >= 0) cleaned = cleaned.slice(0, lastBrace + 1);

        const parsed = JSON.parse(cleaned);
        draftedSubject = parsed.subject || draftedSubject;
        draftedBody = parsed.body || "";
      } catch (e) {
        console.error("inbound-email: Claude draft failed", e);
      }
    }

    if (!draftedBody) {
      // Fall back to a minimal, honest placeholder rather than silently
      // dropping the reply entirely — you still get notified and can write
      // the reply yourself from the queue item.
      draftedBody = `[AI draft failed — reply manually]\n\nOriginal message:\n${incomingText.slice(0, 500)}`;
    } else {
      draftedBody = ensureVerifyLink(draftedBody);
    }

    // ── 7. Insert into the SAME queue table Message Approvals reads from ──
    await fetch(`${supabaseUrl}/rest/v1/queue`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: ownerUserId,
        agent: "Reply AI",
        channel: "email",
        recipient_type: matchedKind || "contact",
        recipient_name: matched?.name || fromAddr,
        to_addr: fromAddr,
        subject: draftedSubject,
        body: draftedBody,
        rationale: `Replying to inbound message: "${incomingText.slice(0, 200)}${incomingText.length > 200 ? "…" : ""}"`,
        status: "pending",
      }),
    });

    await fetch(`${supabaseUrl}/rest/v1/feed`, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: ownerUserId,
        text: `📥 Reply received from ${matched?.name || fromAddr} — AI drafted a response, awaiting your approval`,
        color: "#3b82f6",
      }),
    });

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("inbound-email: unhandled error", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

// ── SETUP NOTES ──
//
// 1. DNS: add a receiving domain on a SUBDOMAIN, never your root domain
//    (Resend's own docs warn: pointing inbound at the root domain routes
//    ALL mail for that domain through Resend, breaking any other mailbox).
//    Recommended: reply.nexustrade.agency
//    In Resend Dashboard → Receiving → Add domain → reply.nexustrade.agency
//    → it will give you an MX record to add in Namecheap Advanced DNS,
//    Host: reply (or as shown), pointing at Resend's inbound value.
//
// 2. Webhook: Resend Dashboard → Webhooks → Add Webhook
//    URL: https://trade-broker-app.vercel.app/api/inbound-email
//    Events: check "email.received"
//    Copy the signing secret (starts with whsec_) into Vercel as
//    RESEND_WEBHOOK_SECRET.
//
// 3. Set the remaining Vercel env vars listed at the top of this file.
//
// 4. Test: send a real email to something@reply.nexustrade.agency and
//    check Vercel → your project → Logs for this function, and check the
//    Team Activity feed / Message Approvals tab in the app.
