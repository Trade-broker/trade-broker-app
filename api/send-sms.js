// ── SERVERLESS RELAY: SMS (Vercel) ──
// Called by the frontend as POST /api/send-sms.
// Keeps the user's Twilio credentials server-side for this single request
// rather than exposing them to the browser (Twilio blocks direct browser
// calls via CORS and requires Basic Auth, which must never sit in client JS).
// No env var needed for Twilio credentials — each user supplies their own
// from Settings → Integrations, passed in the request body.
//
// SAFETY NET: every outgoing SMS is guaranteed to carry a link to the public
// company verification page. The frontend already appends a short version at
// draft time (so the approver sees the exact final text before approving),
// but this server-side check is idempotent — it only appends if the link
// isn't already present — so it can never duplicate. Kept short on purpose:
// SMS is billed per 160-char segment, so this uses "Verify us:" rather than
// the longer email-style line.

const COMPANY_PROFILE_URL = process.env.COMPANY_PROFILE_URL || "https://trade-broker-app.vercel.app/company";

function ensureVerifyLink(body) {
  const safeBody = typeof body === "string" ? body : "";
  if (safeBody.includes(COMPANY_PROFILE_URL)) return safeBody;
  return `${safeBody}\n\nVerify us: ${COMPANY_PROFILE_URL}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { to, body, twilioSid, twilioToken, twilioFrom } = req.body || {};

  // ── Defensive validation ──
  if (!twilioSid || typeof twilioSid !== "string" || !twilioSid.trim()) {
    return res.status(400).json({ error: "Missing Twilio Account SID. Add it in Settings → Integrations." });
  }
  if (!twilioToken || typeof twilioToken !== "string" || !twilioToken.trim()) {
    return res.status(400).json({ error: "Missing Twilio Auth Token. Add it in Settings → Integrations." });
  }
  if (!twilioFrom || typeof twilioFrom !== "string" || !twilioFrom.trim()) {
    return res.status(400).json({ error: "Missing Twilio From Number. Add it in Settings → Integrations." });
  }
  if (!to || typeof to !== "string" || !to.trim()) {
    return res.status(400).json({ error: "Missing recipient phone number." });
  }
  const phoneLike = /^\+?[1-9]\d{7,14}$/;
  if (!phoneLike.test(to.trim().replace(/[\s-()]/g, ""))) {
    return res.status(400).json({ error: `"${to}" doesn't look like a valid phone number. Use E.164 format, e.g. +14155551234.` });
  }

  try {
    const finalBody = ensureVerifyLink(body || "");

    const form = new URLSearchParams({
      To: to.trim(),
      From: twilioFrom.trim(),
      Body: finalBody,
    });

    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid.trim()}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${twilioSid.trim()}:${twilioToken.trim()}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    let data = {};
    try {
      data = await r.json();
    } catch {
      data = { raw: await r.text().catch(() => "") };
    }

    if (!r.ok) {
      return res.status(r.status).json({ error: data?.message || data?.error || "Twilio rejected the request", details: data });
    }

    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}