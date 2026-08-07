// ── SERVERLESS RELAY: SMS (Vercel App Router) ──
// Path: app/api/send-sms/route.js
// Called by the frontend as POST /api/send-sms.
// Keeps Twilio credentials server-side for this request and avoids CORS blocks.

import { NextResponse } from "next/server";

// CORS helper supporting production, local development, and Vercel preview URLs
function getCorsHeaders(request) {
  const origin = request.headers.get("origin") || "";

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

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// Handle CORS Preflight (OPTIONS)
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(request),
  });
}

// Main POST Handler
export async function POST(request) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const payload = await request.json().catch(() => null);

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or empty JSON body provided." },
        { status: 400, headers: corsHeaders }
      );
    }

    const { to, body, accountSid, authToken, fromNumber } = payload;

    // ── Defensive Validation ──
    if (!accountSid || typeof accountSid !== "string" || !accountSid.trim()) {
      return NextResponse.json(
        { error: "Missing Twilio Account SID. Add it in Settings → Integrations." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!authToken || typeof authToken !== "string" || !authToken.trim()) {
      return NextResponse.json(
        { error: "Missing Twilio Auth Token. Add it in Settings → Integrations." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!fromNumber || typeof fromNumber !== "string" || !fromNumber.trim()) {
      return NextResponse.json(
        { error: "Missing Sender Phone Number (From). Add it in Settings → Integrations." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!to || typeof to !== "string" || !to.trim()) {
      return NextResponse.json(
        { error: "Missing recipient phone number (To)." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!body || typeof body !== "string" || !body.trim()) {
      return NextResponse.json(
        { error: "Missing message content body." },
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Prepare Twilio API Request ──
    const cleanSid = accountSid.trim();
    const cleanToken = authToken.trim();
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${cleanSid}/Messages.json`;

    // Twilio REST API expects x-www-form-urlencoded
    const formData = new URLSearchParams();
    formData.append("To", to.trim());
    formData.append("From", fromNumber.trim());
    formData.append("Body", body.trim());

    // Basic Auth Header (AccountSid : AuthToken base64 encoded)
    const authHeader =
      "Basic " + Buffer.from(`${cleanSid}:${cleanToken}`).toString("base64");

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

    // Read stream once as text to prevent double-read errors
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
        "Twilio rejected the SMS. Check phone number formatting (e.g., +27821234567) or credentials.";

      return NextResponse.json(
        { error: errorMessage, details: twilioData },
        { status: twilioResponse.status, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { ok: true, sid: twilioData.sid, status: twilioData.status, data: twilioData },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return NextResponse.json(
      {
        error: isTimeout
          ? "Request timed out waiting for Twilio API response."
          : String(err?.message || err),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
