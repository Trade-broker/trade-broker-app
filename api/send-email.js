export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const key = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const signoff = process.env.MAIL_SIGNOFF || "Trade Desk";
  if (!key || !fromEmail) return res.status(500).json({ error: "Resend env vars not set" });

  try {
    const { to, subject, body } = req.body || {};
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${signoff} <${fromEmail}>`,
        to: [to],
        subject,
        text: body,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    return res.status(200).json({ ok: true, id: data.id });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}