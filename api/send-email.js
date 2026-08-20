// ── VERCEL SERVERLESS FUNCTION: RESEND EMAIL RELAY ──
// Path: api/send-email.js

const COMPANY_PROFILE_URL =
  process.env.COMPANY_PROFILE_URL || "https://e-broker.vercel.app/company";
const CIPC_REG_NO = process.env.CIPC_REG_NO || "2026/565924/07";

// Where replies actually land and trigger the inbound webhook (api/inbound-email.js).
// Deliberately kept SEPARATE from the "from" address: the reply-receiving
// subdomain (reply.nexustrade.agency) is verified for RECEIVING only (MX
// record), not SENDING (DKIM/SPF). Sending FROM that subdomain directly
// would fail with the same "domain not verified" error already fixed for
// the root domain — Reply-To solves it without touching From at all.
const REPLY_TO_ADDRESS = process.env.REPLY_TO_ADDRESS || "hello@reply.nexustrade.agency";

function ensureVerifyLink(body) {
  const safeBody = typeof body === "string" ? body : "";
  if (safeBody.includes(COMPANY_PROFILE_URL)) return safeBody;
  return `${safeBody}\n\n—\nVerify our company registration (CIPC ${CIPC_REG_NO}): ${COMPANY_PROFILE_URL}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { to, subject, body, resendKey, fromEmail } = req.body || {};

  // ── Defensive validation ──
  if (!resendKey || typeof resendKey !== "string" || !resendKey.trim()) {
    return res.status(400).json({ error: "Missing Resend API key. Add it in Settings → Integrations." });
  }
  if (!fromEmail || typeof fromEmail !== "string" || !fromEmail.trim()) {
    return res.status(400).json({ error: "Missing From Email. Add it in Settings → Integrations." });
  }
  if (!to || typeof to !== "string" || !to.trim()) {
    return res.status(400).json({ error: "Missing recipient email address." });
  }
  const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailLike.test(to.trim())) {
    return res.status(400).json({ error: `"${to}" doesn't look like a valid email address.` });
  }

  try {
    const finalBody = ensureVerifyLink(body || "");

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail.trim(),
        to: [to.trim()],
        subject: subject || "",
        text: finalBody,
        reply_to: [REPLY_TO_ADDRESS],
      }),
    });

    let data = {};
    try {
      data = await r.json();
    } catch {
      data = { raw: await r.text().catch(() => "") };
    }

    if (!r.ok) {
      return res.status(r.status).json({ error: data?.message || data?.error || "Resend rejected the request", details: data });
    }

    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
