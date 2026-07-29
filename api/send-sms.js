// ── SERVERLESS RELAY: SMS (Vercel) ──
// Called by the frontend as POST /api/send-sms.
// Keeps the user's Twilio credentials server-side for this single request
// rather than exposing them to the browser (Twilio blocks direct browser
// calls via CORS and requires Basic Auth, which must never sit in client JS).
// No env var needed here — each user supplies their own Twilio credentials
// from Settings → Integrations, which the frontend passes in the request body.

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
  // Basic E.164-ish sanity check (+ then 8-15 digits) — not exhaustive,
  // just enough to catch obvious mistakes before calling out to Twilio
  const phoneLike = /^\+?[1-9]\d{7,14}$/;
  if (!phoneLike.test(to.trim().replace(/[\s-()]/g, ""))) {
    return res.status(400).json({ error: `"${to}" doesn't look like a valid phone number. Use E.164 format, e.g. +14155551234.` });
  }

  try {
    const form = new URLSearchParams({
      To: to.trim(),
      From: twilioFrom.trim(),
      Body: body || "",
    });

    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid.trim()}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${twilioSid.trim()}:${twilioToken.trim()}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    // Twilio returns JSON; fall back gracefully if it doesn't
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