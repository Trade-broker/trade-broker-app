// ── VERCEL SERVERLESS FUNCTION: ANTHROPIC CLAUDE RELAY ──
// Path: api/claude.js

// Pull unique {url, title} source links out of any web_search_tool_result
// blocks in the response. Needed by lib/ai.js's findLeads() to mark leads as
// "Web-verified" vs "Unverified" — without this, every lead looks unverified
// even when a real web search happened.
function extractSources(data) {
  if (!data || !Array.isArray(data.content)) return [];
  const found = [];
  for (const block of data.content) {
    if (block && block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const item of block.content) {
        if (item && item.url) found.push({ url: item.url, title: item.title || item.url });
      }
    }
  }
  const seen = new Set();
  return found.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
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

  const { messages, system, tools, tool_choice, max_tokens, model, apiKey, enableWebSearch } = req.body || {};

  const key = apiKey?.trim() || process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return res.status(400).json({
      error: "Missing Anthropic API key. Add it in Settings → Integrations or Vercel Environment Variables.",
    });
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'messages' array." });
  }

  try {
    const bodyPayload = {
      // FIXED: previous default ("claude-3-7-sonnet-20250219") was a
      // retired model ID, so every call missing an explicit `model` field
      // failed outright with "model: claude-3-7-sonnet-20250219" as the
      // error — which is exactly what caused every Lead Finder search,
      // cycle, and check-in draft to fail. Default now matches lib/ai.js's
      // own fallback so client and server agree even if one omits it.
      model: model || "claude-sonnet-4-6",
      max_tokens: max_tokens || 1500,
      messages: messages,
    };

    if (system && typeof system === "string" && system.trim()) {
      bodyPayload.system = system.trim();
    }

    // Explicit tools array (new contract) takes priority. If none was
    // provided but the caller set the legacy enableWebSearch flag (used by
    // lib/ai.js's findLeads), auto-attach the hosted web_search tool so
    // lead research keeps working without every call site needing to know
    // the exact tool schema.
    if (Array.isArray(tools) && tools.length > 0) {
      bodyPayload.tools = tools;
      if (tool_choice) bodyPayload.tool_choice = tool_choice;
    } else if (enableWebSearch) {
      bodyPayload.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
    }

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

    const responseText = await r.text().catch(() => "");
    let data = {};

    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { raw: responseText };
    }

    if (!r.ok) {
      return res.status(r.status).json({
        error: data?.error?.message || "Anthropic rejected the request.",
        detail: data,
      });
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .filter(Boolean)
      .join("\n");

    const sources = extractSources(data);

    return res.status(200).json({ text, sources, content: data.content, usage: data.usage });
  } catch (e) {
    const isTimeout = e.name === "AbortError";
    return res.status(500).json({
      error: isTimeout ? "Request timed out waiting for Anthropic API." : String(e?.message || e),
    });
  }
}
