export async function callClaude(messages, system = "", { tools, maxTokens } = {}) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, system, tools, max_tokens: maxTokens }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "AI request failed");
  return data;
}

export function parseJSON(txt) {
  if (!txt) throw new Error("Empty response");
  const clean = txt.replace(/```json|```/g, "").trim();
  const s = clean.indexOf("{");
  const sa = clean.indexOf("[");
  const start = sa !== -1 && (sa < s || s === -1) ? sa : s;
  return JSON.parse(start > 0 ? clean.slice(start) : clean);
}

const WEB_SEARCH = [{ type: "web_search_20250305", name: "web_search" }];

export async function findLeads({ focus, market, existing = [] }) {
  const sys = `You are the autonomous Lead Finder for a trade broker. You search the web for REAL companies
that could be buyers or suppliers matching the broker's focus, and return them as candidate leads.
Be truthful: these are researched candidates, not confirmed customers. Only return companies you actually
find evidence for. Pull public contact info (website, public email/phone) where available; leave blank if unknown.
Never invent contact details.`;

  const prompt = `Broker focus: ${focus || "Broad bulk-commodity trade (vapes, fuel, diesel, petroleum, solar panels, vehicles, any high-volume goods)"}.
Primary market / regions: ${market || "Global, with emphasis on Africa, GCC, EU"}.
Already in their list (don't repeat): ${existing.slice(0, 40).join(", ") || "none"}.

Search the web and propose up to 6 strong candidate companies (mix of buyers and suppliers).
For each, return real, verifiable companies. Then respond with ONLY this JSON (no commentary):
{
  "leads": [
    {
      "kind": "buyer" or "supplier",
      "name": "",
      "country": "",
      "sector": "",
      "product": "what they buy or sell",
      "website": "",
      "email": "",
      "phone": "",
      "why_fit": "one sentence on why they fit the broker's focus"
    }
  ]
}`;

  const data = await callClaude([{ role: "user", content: prompt }], sys, { tools: WEB_SEARCH, maxTokens: 2500 });
  const parsed = parseJSON(data.text);
  return parsed.leads || [];
}
