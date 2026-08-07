// ── SERVERLESS RELAY: EMAIL (Vercel) ──
// Called by the frontend as POST /api/send-email.
// Keeps the user's Resend API key server-side for this single request rather
// than exposing it to the browser (Resend blocks direct browser calls via CORS).
// No env var needed for the Resend key — each user supplies their own Resend
// key from Settings → Integrations, which the frontend passes in the request body.
//
// SAFETY NET: every outgoing email is guaranteed to carry a link to the
// public company verification page. The frontend already appends this at
// draft time (so the approver sees the exact final text before approving),
// but this server-side check is idempotent — it only appends if the link
// isn't already present — so it can never duplicate, and it protects against
// any future code path that forgets to add it client-side.

const COMPANY_PROFILE_URL = process.env.COMPANY_PROFILE_URL || "https://trade-broker-app.vercel.app/company";
const CIPC_REG_NO = process.env.CIPC_REG_NO || "2026/565924/07";

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