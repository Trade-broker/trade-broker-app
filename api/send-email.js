// ── SERVERLESS RELAY: EMAIL (Vercel App Router) ──
// Path: app/api/send-email/route.js
// Called by the frontend as POST /api/send-email.
// Keeps the user's Resend API key server-side for this single request rather
// than exposing it to the browser (Resend blocks direct browser calls via CORS).

import { NextResponse } from "next/server";

const COMPANY_PROFILE_URL =
  process.env.COMPANY_PROFILE_URL || "https://e-broker.vercel.app/company";
const CIPC_REG_NO = process.env.CIPC_REG_NO || "2026/565924/07";

// Helper: Ensures company verification link is appended to body idempotently
function ensureVerifyLink(body) {
  const safeBody = typeof body === "string" ? body : "";
  if (safeBody.includes(COMPANY_PROFILE_URL)) return safeBody;
  return `${safeBody}\n\n—\nVerify our company registration (CIPC ${CIPC_REG_NO}): ${COMPANY_PROFILE_URL}`;
}

// CORS headers locked down to your deployed domain + local development
function getCorsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const allowedOrigins = [
    "https://e-broker.vercel.app",
    "https://trade-broker-app.vercel.app",
    "http://localhost:3000",
    "http://localhost:5173",
  ];

  const isAllowed = allowedOrigins.includes(origin);

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

    const { to, subject, body, resendKey, fromEmail } = payload;

    // ── Defensive Validation ──
    if (!resendKey || typeof resendKey !== "string" || !resendKey.trim()) {
      return NextResponse.json(
        { error: "Missing Resend API key. Please add it in Settings → Integrations." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!fromEmail || typeof fromEmail !== "string" || !fromEmail.trim()) {
      return NextResponse.json(
        { error: "Missing Sender Email (From). Please add it in Settings → Integrations." },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!to || typeof to !== "string" || !to.trim()) {
      return NextResponse.json(
        { error: "Missing recipient email address." },
        { status: 400, headers: corsHeaders }
      );
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(to.trim())) {
      return NextResponse.json(
        { error: `"${to}" is not a valid recipient email address.` },
        { status: 400, headers: corsHeaders }
      );
    }

    const finalBody = ensureVerifyLink(body || "");

    // ── Dispatch to Resend API ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10-second request timeout

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey.trim()}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        from: fromEmail.trim(),
        to: [to.trim()],
        subject: subject ? subject.trim() : "No Subject",
        text: finalBody,
      }),
    });

    clearTimeout(timeout);

    let resendData = {};
    try {
      resendData = await resendResponse.json();
    } catch {
      resendData = { raw: await resendResponse.text().catch(() => "") };
    }

    if (!resendResponse.ok) {
      const errorMessage =
        resendData?.message ||
        resendData?.error ||
        "Resend rejected the request. Verify that your sender domain is verified in Resend.";

      return NextResponse.json(
        { error: errorMessage, details: resendData },
        { status: resendResponse.status, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { ok: true, id: resendData.id, data: resendData },
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    const isTimeout = err.name === "AbortError";
    return NextResponse.json(
      {
        error: isTimeout
          ? "Request timed out waiting for Resend API response."
          : String(err?.message || err),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
