// ── SERVERLESS RELAY: ANTHROPIC CLAUDE (Pages Router / API Route) ──
// Path: pages/api/anthropic.js or api/anthropic.js

export default async function handler(req, res) {
  // ── 1. CORS Headers ──
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

  // Handle preflight CORS request
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  // ── 2. Payload Extraction & Key Resolution ──
  const { messages, system, tools, tool_choice, max_tokens, model, apiKey } = req.body || {};

  // Prioritize key passed from frontend settings, then environment variable
  const key = apiKey?.trim() || process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return res.status(400).json({
      error: "Missing Anthropic API Key. Provide it in request body or set ANTHROPIC_API_KEY in Vercel environment variables.",
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'messages' array." });
  }

  try {
    // Construct Anthropic request body
    const bodyPayload = {
      model: model || "claude-3-7-sonnet-20250219", // Default fallback model
      max_tokens: max_tokens || 1500,
      messages: messages,
    };

    // Only include system if non-empty
    if (system && typeof system === "string" && system.trim()) {
      bodyPayload.system = system.trim();
    } else if (Array.isArray(system) && system.length > 0) {
      bodyPayload.system = system;
    }

    if (Array.isArray(tools) && tools.length > 0) {
      bodyPayload.tools = tools;
      if (tool_choice) bodyPayload.tool_choice = tool_choice;
    }

    // ── 3. Dispatch to Anthropic API ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25s timeout

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      signal: controller.signal,
      body: JSON.stringify(bodyPayload),
    });

    clearTimeout(timeout);

    // Read response safely as text first to prevent "stream already read" crashes
    const responseText = await r.text().catch(() => "");
    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { raw: responseText };
    }

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "Anthropic API rejected the request.",
        detail: data,
      });
    }

    // Extract text blocks cleanly
    const text = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .filter(Boolean)
      .join("\n");

    return res.status(200).json({
      text,
      content: data.content,
      role: data.role,
      model: data.model,
      usage: data.usage,
    });
  } catch (e) {
    const isTimeout = e.name === "AbortError";
    return res.status(500).json({
      error: isTimeout
        ? "Request timed out waiting for Anthropic API response."
        : String(e?.message || e),
    });
  }
}
