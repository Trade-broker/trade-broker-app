// ── VERCEL SERVERLESS FUNCTION: TWILIO SMS RELAY ──
// Path: api/send-sms.js

export default async function handler(req, res) {
  // ── CORS Headers ──
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

  const { to, body, accountSid, authToken, fromNumber } = req.body || {};

  // ── Defensive Validation ──
  if (!accountSid || typeof accountSid !== "string" || !accountSid.trim()) {
    return res.status(400).json({ error: "Missing Twilio Account SID. Add it in Settings → Integrations." });
  }
  if (!authToken || typeof authToken !== "string" || !authToken.trim()) {
    return res.status(400).json({ error: "Missing Twilio Auth Token. Add it in Settings → Integrations." });
  }
  if (!fromNumber || typeof fromNumber !== "string" || !fromNumber.trim()) {
    return res.status(400).json({ error: "Missing Sender Phone Number (From). Add it in Settings → Integrations." });
  }
  if (!to || typeof to !== "string" || !to.trim()) {
    return res.status(400).json({ error: "Missing recipient phone number (To)." });
  }
  if (!body || typeof body !== "string" || !body.trim()) {
    return res.status(400).json({ error: "Missing message content body." });
  }

  try {
    const cleanSid = accountSid.trim();
    const cleanToken = authToken.trim();
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${cleanSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append("To", to.trim());
    formData.append("From", fromNumber.trim());
    formData.append("Body", body.trim());

    const authHeader = "Basic " + Buffer.from(`${cleanSid}:${cleanToken}`).toString("base64");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      signal: controller.signal,
      body: formData.toString(),
    });

    clearTimeout(timeout);

    // Read stream once as text to prevent "stream already read" crashes
    const responseText = await twilioResponse.text().catch(() => "");
    let twilioData = {};

    try {
      twilioData = responseText ? JSON.parse(responseText) : {};
    } catch {
      twilioData = { raw: responseText };
    }

    if (!twilioResponse.ok) {
      const errorMessage =
        twilioData?.message ||
        twilioData?.error_message ||
        "Twilio rejected the SMS request. Check phone number format (e.g., +27821234567).";

      return res.status(twilioResponse.status).json({ error: errorMessage, details: twilioData });
    }

    return res.status(200).json({ ok: true, sid: twilioData.sid, status: twilioData.status, data: twilioData });
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return res.status(500).json({
      error: isTimeout ? "Request timed out waiting for Twilio API." : String(err?.message || err),
    });
  }
}
