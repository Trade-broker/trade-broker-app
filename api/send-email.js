// ── VERCEL SERVERLESS FUNCTION: RESEND EMAIL RELAY ──
// Path: api/send-email.js

const COMPANY_PROFILE_URL =
  process.env.COMPANY_PROFILE_URL || "https://e-broker.vercel.app/company";
const CIPC_REG_NO = process.env.CIPC_REG_NO || "2026/565924/07";

function ensureVerifyLink(body) {
  const safeBody = typeof body === "string" ? body : "";
  if (safeBody.includes(COMPANY_PROFILE_URL)) return safeBody;
  return `${safeBody}\n\n—\nVerify our company registration (CIPC ${CIPC_REG_NO}): ${COMPANY_PROFILE_URL}`;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  const allowedOrigins = [
    "https://e-broker.vercel.app",
    "https://trade-broker-app.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
  ];

  const isAllowed =
    allowedOrigins.includes(origin) ||
    /^https:\/\/[a-zA-Z0-9-]+-.*\.vercel\.app$/.test(origin) ||
    origin.endsWith(".vercel.app");

  res.setHeader("Access-Control-Allow-Origin", isAllowed ? origin : allowedOrigins[0]);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { to, subject, body, html, resendKey, fromEmail } = req.body || {};

  if (!resendKey || typeof resendKey !== "string" || !resendKey.trim()) {
    return res.status(400).json({ error: "Missing Resend API key. Add it in Settings → Integrations." });
  }
  if (!fromEmail || typeof fromEmail !== "string" || !fromEmail.trim()) {
    return res.status(400).json({ error: "Missing Sender Email (From). Add it in Settings → Integrations." });
  }
  if (!to || typeof to !== "string" || !to.trim()) {
    return res.status(400).json({ error: "Missing recipient email address." });
  }

  try {
    const contentBody = body || html || "";
    const finalBody = ensureVerifyLink(contentBody);
    const isHtml = /<[a-z][\s\S]*>/i.test(finalBody);

    const emailPayload = {
      from: fromEmail.trim(),
      to: [to.trim()],
      subject: subject ? subject.trim() : "No Subject",
      ...(isHtml ? { html: finalBody } : { text: finalBody }),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey.trim()}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify(emailPayload),
    });

    clearTimeout(timeout);

    const responseText = await r.text().catch(() => "");
    let data = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { raw: responseText };
    }

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.message || data?.error || "Resend rejected the email request.",
        details: data,
      });
    }

    return res.status(200).json({ ok: true, id: data.id, data });
  } catch (e) {
    const isTimeout = e.name === "AbortError";
    return res.status(500).json({
      error: isTimeout ? "Request timed out waiting for Resend API." : String(e?.message || e),
    });
  }
}
