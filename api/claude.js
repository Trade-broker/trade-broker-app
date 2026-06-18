export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not set in Vercel environment variables" });
    return;
  }
  try {
    const { messages, system, tools, max_tokens } = req.body || {};
    const body = {
      model: "claude-sonnet-4-6",
      max_tokens: max_tokens || 1500,
      system: system || "",
      messages: messages || [],
    };
    if (tools && tools.length) body.tools = tools;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) {
      res.status(r.status).json({ error: data?.error?.message || "Anthropic error", detail: data });
      return;
    }
    const text = (data.content || []).map((b) => b.text || "").filter(Boolean).join("\n");
    res.status(200).json({ text, content: data.content });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
}
