// ── VERCEL SERVERLESS FUNCTION: TWILIO SMS RELAY ──
// Path: api/send-sms.js

const COMPANY_PROFILE_URL =
  process.env.COMPANY_PROFILE_URL || "https://e-broker.vercel.app/company";

// Idempotent — only appends if not already present, so it never duplicates
// (e.g. if the frontend already appended it before sending).
function ensureVerifyLink(body) {
  const safeBody = typeof body === "string" ? body : "";
  if (safeBody.includes(COMPANY_PROFILE_URL)) return safeBody;
  return `${safeBody}\n\nVerify us: ${COMPANY_PROFILE_URL}`;
}

// Translates common Twilio SMS error codes into plain-language messages the
// broker can actually act on, instead of raw Twilio API text. Falls back to
// Twilio's own message for anything not in this list, so nothing is ever
// hidden — just made clearer where possible.
// Reference: https://www.twilio.com/docs/api/errors
const TWILIO_ERROR_HINTS = {
  21211: "That phone number isn't formatted correctly. Use E.164 format, e.g. +27821234567.",
  21408: "Your Twilio account isn't permitted to send SMS to that country yet. Check Console → Messaging → Settings → Geographic Permissions and enable it there.",
  21606: "The 'From' number isn't a valid, SMS-capable number on your Twilio account. Check Settings → Integrations → From Number.",
  21610: "That recipient has previously opted out (replied STOP) and can't be messaged again unless they opt back in.",
  21612: "This number can't send to that country yet. In Twilio Console, check that your regulatory bundle for that country is actually assigned to this sending number (Phone Numbers → Manage → Active Numbers → your number → Regulatory Compliance) — having an Accepted bundle isn't enough, it must be linked to the number itself. For US toll-free numbers, also confirm Toll-Free Verification is complete under Messaging → Senders.",
  21614: "That 'To' number isn't a valid mobile number capable of receiving SMS.",
  30003: "The recipient's phone is unreachable (may be switched off or out of service).",
  30004: "The recipient has blocked messages from this number.",
  30005: "That number is unknown or no longer in service.",
  30006: "The recipient's carrier flagged this as unable to be delivered to a landline or unsupported number.",
  30007: "This message was flagged and filtered as spam by the recipient's carrier.",
};

function friendlyTwilioError(twilioData, fallback) {
  const code = twilioData?.code;
  if (code && TWILIO_ERROR_HINTS[code]) {
    return `${TWILIO_ERROR_HINTS[code]} (Twilio error ${code})`;
  }
  return fallback;
}

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

  const raw = req.body || {};

  // Accept both naming conventions so this works regardless of which the
  // calling frontend code uses (twilioSid/twilioToken/twilioFrom is what
  // MainApp.jsx's approveMsg sends; accountSid/authToken/fromNumber is what
  // this file previously expected). Prevents silent "missing credential"
  // errors caused purely by a naming mismatch between client and server.
  const to = raw.to;
  const body = raw.body;
  const accountSid = raw.accountSid || raw.twilioSid;
  const authToken = raw.authToken || raw.twilioToken;
  const fromNumber = raw.fromNumber || raw.twilioFrom;

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

    const finalBody = ensureVerifyLink(body.trim());

    const formData = new URLSearchParams();
    formData.append("To", to.trim());
    formData.append("From", fromNumber.trim());
    formData.append("Body", finalBody);

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
      const rawMessage =
        twilioData?.message ||
        twilioData?.error_message ||
        "Twilio rejected the SMS request. Check phone number format (e.g., +27821234567).";

      const errorMessage = friendlyTwilioError(twilioData, rawMessage);

      return res.status(twilioResponse.status).json({ error: errorMessage, details: twilioData });
    }

    // A 201/queued response doesn't guarantee delivery — Twilio can still
    // fail the message asynchronously afterward (this is exactly what
    // happened in the UK toll-free case: it queued successfully, then
    // failed ~1.5s later with error 21612). We can't await that here without
    // polling, so we surface status/sid so the frontend can show "queued"
    // rather than implying final delivery, and the person can check the
    // Twilio message log if something looks off downstream.
    return res.status(200).json({
      ok: true,
      sid: twilioData.sid,
      status: twilioData.status,
      data: twilioData,
    });
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return res.status(500).json({
      error: isTimeout ? "Request timed out waiting for Twilio API." : String(err?.message || err),
    });
  }
}
