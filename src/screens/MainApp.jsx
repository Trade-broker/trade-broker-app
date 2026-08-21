import { useState, useEffect, useRef, useCallback, Component } from "react";
import { supabase } from "../lib/supabase";
import { callClaude, parseJSON, findLeads } from "../lib/ai";
import { T, SVG, IC, Btn, Input, Select, Field, Pill, Logo } from "../lib/ui.jsx";

// ── AGENTS ──
const AGENTS = [
  { id:"ceo", name:"CEO AI", color:T.amber, icon:IC.ceo, desc:"Orchestrates the operation, sets strategy, decides which deals the team pursues." },
  { id:"finder", name:"Lead Finder AI", color:T.cyan, icon:IC.search, desc:"Searches the web for real buyer & supplier candidates matching your focus." },
  { id:"deal", name:"Deal Maker AI", color:T.purple, icon:IC.opp, desc:"Matches buyers to suppliers, structures terms, calculates commission." },
  { id:"outreach", name:"Outreach AI", color:T.orange, icon:IC.msg, desc:"Writes every outbound message for your approval, then sends on confirmation." },
  { id:"risk", name:"Risk AI", color:T.red, icon:IC.lock, desc:"Flags counterparty and regulatory risk before you approve." },
  { id:"revenue", name:"Revenue AI", color:T.green, icon:IC.rev, desc:"Forecasts commissions and books earnings when deals close." },
];

const NAV = [
  { id:"dashboard", label:"Dashboard", icon:IC.dash, color:T.amber },
  { id:"autopilot", label:"AI Autopilot", icon:IC.bolt, color:T.amber },
  { id:"leads", label:"Lead Approvals", icon:IC.search, color:T.cyan },
  { id:"approvals", label:"Message Approvals", icon:IC.inbox, color:T.orange },
  { id:"opportunities", label:"Opportunities", icon:IC.opp, color:T.purple },
  { id:"pipeline", label:"Pipeline", icon:IC.kanban, color:T.green },
  { id:"contacts", label:"Contacts", icon:IC.buyers, color:T.blue },
  { id:"sent", label:"Sent Log", icon:IC.mail, color:T.blue },
  { id:"documents", label:"Legal & Invoices", icon:IC.scale, color:T.pink },
  { id:"revenue", label:"Earnings", icon:IC.wallet, color:T.green },
  { id:"agents", label:"AI Agents", icon:IC.agent, color:T.purple },
  { id:"settings", label:"Settings", icon:IC.settings, color:T.muted },
];

// small helpers
const fmtMoney = (n, cur="USD") => `${cur} ${Number(n||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`;

// Reads an error message from a failed fetch Response, preferring a JSON
// { error } field (returned by /api/send-email and /api/send-sms) and
// falling back to raw text if the body isn't JSON.
const readErrorMessage = async (res) => {
  const raw = await res.text().catch(() => "");
  try {
    const parsed = JSON.parse(raw);
    return parsed?.error || parsed?.message || raw || `Request failed (${res.status})`;
  } catch {
    return raw || `Request failed (${res.status})`;
  }
};

// ── COMPANY / LEGAL / FOOTER ──
const COMPANY = { name: "BLACK GOLD NEXUS (PTY) LTD", reg: "2026/565924/07", email: "blackgoldnexus@gmail.com" };

// Public verification page URL. Override in your .env with
// VITE_COMPANY_PROFILE_URL once the /company route is live on your domain.
const COMPANY_PROFILE_URL = import.meta.env.VITE_COMPANY_PROFILE_URL || "https://trade-broker-app.vercel.app/company";

// Appends a link to the public company verification page to an outbound
// message body. Idempotent — checks whether the link is already present
// before appending, so calling this twice (e.g. on a regenerated message)
// never produces a duplicate. SMS gets a short line (billed per segment);
// email gets a slightly fuller signature-style line.
function appendVerifyLine(body, channel) {
  const safeBody = body || "";
  if (safeBody.includes(COMPANY_PROFILE_URL)) return safeBody;
  const line = channel === "sms"
    ? `\n\nVerify us: ${COMPANY_PROFILE_URL}`
    : `\n\n—\nVerify our company registration (CIPC ${COMPANY.reg}): ${COMPANY_PROFILE_URL}`;
  return safeBody + line;
}

const LEGAL_TEXT = {
  terms: `TERMS AND CONDITIONS — TEMPLATE, REVIEW WITH A QUALIFIED ATTORNEY BEFORE PUBLISHING

1. Acceptance
By using Opportunity Command AI (the "App"), operated by ${COMPANY.name} (Reg: ${COMPANY.reg}), you agree to these Terms.

2. Nature of the Service
The App is an internal trade-brokerage tool providing AI-assisted lead discovery, outreach drafting, deal tracking, and document generation. It does not itself execute contracts, guarantee outcomes, or replace professional legal, tax, or financial advice.

3. Your Responsibilities
You are the sole sender of any approved message and are responsible for reviewing all AI-proposed leads, outreach, and generated documents before acting on them.

4. No Guarantees
${COMPANY.name} makes no warranty that any lead, deal, or opportunity identified through the App will result in a successful transaction or profit.

5. Limitation of Liability
To the maximum extent permitted by law, ${COMPANY.name} is not liable for indirect, incidental, or consequential losses arising from use of the App.

6. Governing Law
These Terms are governed by the laws of South Africa.

Contact: ${COMPANY.email}`,

  privacy: `PRIVACY POLICY — TEMPLATE, REVIEW WITH A QUALIFIED ATTORNEY BEFORE PUBLISHING

1. Information We Process
Buyer, supplier, opportunity, message, and business/banking data you enter is stored in your account to operate the App. Content sent to the AI provider is processed solely to generate the requested drafts.

2. Purpose
Information is used to run your trade-brokerage operations within the App — it is not sold or shared with third parties for marketing.

3. Your Rights (POPIA)
Under the Protection of Personal Information Act, you may request access to, correction of, or deletion of personal information processed through the App. Contact ${COMPANY.email}.

4. Security
Reasonable technical measures (including per-user authentication and row-level security) protect stored data. No system is completely secure.

5. Retention
Data is retained for as long as your account is active, or as required by law.

Contact: ${COMPANY.email}`,

  disclaimer: `DISCLAIMER — TEMPLATE, REVIEW WITH A QUALIFIED ATTORNEY BEFORE PUBLISHING

Opportunity Command AI is an internal decision-support tool. AI-proposed leads are research candidates only, not confirmed buyers or suppliers, and must be independently verified. AI-drafted messages and legal/commercial document templates are provided "as is" and are not legal, financial, or tax advice — have them reviewed by a qualified South African attorney before use.

${COMPANY.name} (Reg: ${COMPANY.reg}) accepts no liability for actions taken based on AI-generated content without independent verification.`,
};

function Footer({ onOpenLegal }) {
  const year = new Date().getFullYear();
  return (
    <div className="mt-10 pt-6 border-t max-w-5xl mx-auto w-full" style={{ borderColor: T.border }}>
      <div className="grid sm:grid-cols-3 gap-6">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: T.muted }}>Useful Resources</div>
          <div className="flex flex-col gap-1.5 text-xs" style={{ color: T.dim }}>
            <span>Trade brokerage document templates</span>
            <span>Commission &amp; invoicing guidance</span>
            <span>Compliance calendar (CIPC annual return)</span>
          </div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: T.muted }}>Need Help?</div>
          <div className="flex flex-col gap-1.5 text-xs" style={{ color: T.dim }}>
            <span>Support: {COMPANY.email}</span>
            <span>CIPC: www.cipc.co.za · 0861 002 472</span>
            <a href={COMPANY_PROFILE_URL} target="_blank" rel="noreferrer" className="text-left underline" style={{ color: T.dim }}>Company Verification Profile ↗</a>
          </div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: T.muted }}>Legal</div>
          <div className="flex flex-col gap-1.5 text-xs">
            <button onClick={() => onOpenLegal("terms")} className="text-left underline" style={{ color: T.dim }}>Terms and Conditions</button>
            <button onClick={() => onOpenLegal("privacy")} className="text-left underline" style={{ color: T.dim }}>Privacy Policy</button>
            <button onClick={() => onOpenLegal("disclaimer")} className="text-left underline" style={{ color: T.dim }}>Disclaimer</button>
          </div>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs" style={{ borderColor: T.border, color: T.dim }}>
        <span>© {year} {COMPANY.name} — Reg: {COMPANY.reg}. All rights reserved.</span>
        <span>Opportunity Command AI</span>
      </div>
    </div>
  );
}

// ── ERROR BOUNDARY ──
// Catches render-time errors in any child so a single broken component
// (a bad modal, a malformed record, etc.) shows a recoverable screen instead
// of a blank white page. Must be a class component — React only supports
// error boundaries via getDerivedStateFromError/componentDidCatch.
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error("MainApp crashed:", error, info); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center p-6" style={{ background: T.bg, color: T.text }}>
          <div className="max-w-md w-full rounded-2xl p-6 flex flex-col gap-4 text-center" style={{ background: T.card, border: `1px solid ${T.red}44` }}>
            <div className="text-lg font-bold" style={{ color: T.red }}>Something went wrong</div>
            <p className="text-sm" style={{ color: T.muted }}>A part of the app hit an unexpected error. Your data is safe — reloading usually fixes this.</p>
            <button onClick={() => window.location.reload()} className="w-full py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: T.amber+"22", color: T.amber, border: `1px solid ${T.amber}44` }}>Reload App</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MainApp({ session, profile, onLogout, refreshProfile }) {
  const uid = session.user.id;
  const [tab, setTab] = useState("dashboard");
  const [sideOpen, setSideOpen] = useState(true);
  const [toast, setToast] = useState(null);

  // data
  const [leads, setLeads] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [opps, setOpps] = useState([]);
  const [queue, setQueue] = useState([]);
  const [sent, setSent] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [docs, setDocs] = useState([]);
  const [feed, setFeed] = useState([]);

  // ui state
  const [busy, setBusy] = useState("");
  const [quickFocus, setQuickFocus] = useState("");
  const [autoOn, setAutoOn] = useState(false);
  const [briefing, setBriefing] = useState("");
  const [chatAgent, setChatAgent] = useState(null);
  const [viewDoc, setViewDoc] = useState(null);
  const [docGenType, setDocGenType] = useState(null);
  const [legalDoc, setLegalDoc] = useState(null);

  // editable settings (profile mirror)
  const [p, setP] = useState(profile || {});
  useEffect(() => { setP(profile || {}); }, [profile]);

  const notify = (msg, type="success") => { setToast({ msg, type }); setTimeout(()=>setToast(null), 3200); };

  // ── LOADERS ──
  const loadAll = useCallback(async () => {
    const tables = [
      ["leads", setLeads], ["buyers", setBuyers], ["suppliers", setSuppliers],
      ["opportunities", setOpps], ["queue", setQueue], ["sent", setSent],
      ["earnings", setEarnings], ["documents", setDocs], ["feed", setFeed],
    ];
    await Promise.all(tables.map(async ([t, set]) => {
      const { data } = await supabase.from(t).select("*").eq("user_id", uid).order("created_at", { ascending: false });
      set(data || []);
    }));
  }, [uid]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const logFeed = async (text, color=T.muted) => {
    const row = { user_id: uid, text, color };
    const { data } = await supabase.from("feed").insert(row).select().single();
    if (data) setFeed(f => [data, ...f].slice(0, 80));
  };

  // computed
  const totalPipeline = opps.reduce((s,o)=>s+(Number(o.commission)||0),0);
  const bookedEarnings = earnings.reduce((s,e)=>s+(Number(e.amount)||0),0);
  const activeDeals = opps.filter(o=>["Active","Closing"].includes(o.status)).length;
  const pendingLeads = leads.filter(l=>l.status==="proposed");
  const emailReady = !!(p.resend_key && p.from_email);
  const smsReady = !!(p.twilio_sid && p.twilio_token && p.twilio_from);
  const cur = p.currency || "USD";

  // ── AI: LEAD FINDER ──
  // Accepts an optional `overrideFocus` so the person can search for
  // ANYTHING on the spot ("solar panels" today, "grass" tomorrow,
  // "building materials" after that) without ever touching Settings.
  // If left blank, falls back to the persisted default in p.focus.
  const runLeadFinder = async (overrideFocus) => {
    if (busy) return;
    setBusy("leads");
    const activeFocus = (overrideFocus && overrideFocus.trim()) || p.focus;
    await logFeed(`🔎 Lead Finder AI searching the web for: ${activeFocus || "broad bulk trade"}…`, T.cyan);
    try {
      const existing = [...buyers.map(b=>b.name), ...suppliers.map(s=>s.name), ...leads.map(l=>l.name)];
      const found = await findLeads({ focus: activeFocus, market: p.market, existing });
      if (!found.length) { await logFeed("No new candidates this pass.", T.muted); notify("No new leads found"); return; }
      const rows = found.map(l => ({
        user_id: uid, kind: l.kind || "buyer", name: l.name, country: l.country || "",
        sector: l.sector || "", product: l.product || "", email: l.email || "", phone: l.phone || "",
        website: l.website || "", why_fit: l.why_fit || "", status: "proposed",
      }));
      const { data } = await supabase.from("leads").insert(rows).select();
      setLeads(prev => [...(data||[]), ...prev]);
      await logFeed(`✨ Lead Finder proposed ${rows.length} candidates — awaiting your approval`, T.cyan);
      notify(`${rows.length} leads found — review them`);
      setTab("leads");
    } catch (e) {
      await logFeed(`⚠️ Lead Finder error: ${e.message}`, T.red);
      notify("Lead Finder error: " + e.message, "error");
    } finally { setBusy(""); }
  };

  // approve a lead → becomes a real contact, then AI drafts outreach (also approval-gated)
  const approveLead = async (lead) => {
    await supabase.from("leads").update({ status: "approved" }).eq("id", lead.id);
    setLeads(prev => prev.map(l => l.id===lead.id ? {...l, status:"approved"} : l));
    if (lead.kind === "supplier") {
      const row = { user_id: uid, name: lead.name, country: lead.country, product: lead.product, email: lead.email, phone: lead.phone, notes: lead.why_fit, certified: false };
      const { data } = await supabase.from("suppliers").insert(row).select().single();
      if (data) setSuppliers(s => [data, ...s]);
    } else {
      const row = { user_id: uid, name: lead.name, country: lead.country, industry: lead.sector || lead.product, email: lead.email, phone: lead.phone, notes: lead.why_fit, status: "New" };
      const { data } = await supabase.from("buyers").insert(row).select().single();
      if (data) setBuyers(b => [data, ...b]);
    }
    await logFeed(`✅ Approved lead: ${lead.name} — drafting outreach…`, T.green);
    notify(`${lead.name} approved`);
    draftOutreachForLead(lead);
  };
  const declineLead = async (lead) => {
    await supabase.from("leads").update({ status: "declined" }).eq("id", lead.id);
    setLeads(prev => prev.filter(l => l.id!==lead.id));
    await logFeed(`✗ Declined lead: ${lead.name}`, T.muted);
  };

  const draftOutreachForLead = async (lead) => {
    try {
      const channel = lead.email ? "email" : (lead.phone ? "sms" : "email");
      const sys = "You are Outreach AI for a trade broker. Write concise, professional first-contact messages. Written only — no calls/meetings. No profit guarantees. Sign off with the broker's sign-off. Always end with a brief, natural line letting the recipient opt out of further contact (e.g. 'Reply to let me know if you'd rather not be contacted again.').";
      const prompt = `Draft a first-contact ${channel} to ${lead.name} (${lead.country}, ${lead.sector || lead.product}). They are a potential ${lead.kind}. Broker focus: ${p.focus || "bulk trade"}. Sign off: "${p.signoff || "Trade Operations"}". Under 130 words, include a brief natural opt-out line. Return JSON: { "subject": "", "body": "" }`;
      const data = await callClaude([{ role:"user", content: prompt }], sys);
      const r = parseJSON(data.text);
      const row = {
        user_id: uid, agent: "Outreach AI", channel,
        recipient_type: lead.kind, recipient_name: lead.name,
        to_addr: channel==="sms" ? (lead.phone||"") : (lead.email||""),
        subject: r.subject || "Introduction", body: appendVerifyLine(r.body || "", channel), rationale: lead.why_fit, status: "pending",
      };
      const { data: q } = await supabase.from("queue").insert(row).select().single();
      if (q) setQueue(prev => [q, ...prev]);
      await logFeed(`✉️ Outreach drafted to ${lead.name} — awaiting approval`, T.orange);
    } catch (e) { await logFeed(`⚠️ Draft error for ${lead.name}: ${e.message}`, T.red); }
  };

  // ── RELATIONSHIP AI: nurture check-ins for existing contacts ──
  // Drafts a warm, non-salesy message (not a pitch) to keep an existing
  // relationship warm. Goes through the same approval queue as everything else.
  const draftCheckIn = async (contact, kind) => {
    // REAL guard (the earlier attempt at this was a no-op — this one actually blocks)
    if (contact.dnc) {
      notify(`${contact.name} is marked Do Not Contact — no message drafted.`, "error");
      return;
    }
    try {
      const channel = contact.email ? "email" : (contact.phone ? "sms" : "email");
      const to_addr = channel === "sms" ? (contact.phone || "") : (contact.email || "");
      if (!to_addr) { notify(`No ${channel === "sms" ? "phone" : "email"} on file for ${contact.name}`, "error"); return; }
      const sys = "You are Relationship AI for a trade broker. Write a brief, warm check-in message to an existing contact — not a sales pitch. The goal is to keep the relationship active: share a short relevant market observation, ask how things are going on their end, or reference their industry. Written only. No profit guarantees. Sign off with the broker's sign-off. End with one short line offering to stop these check-ins on request (e.g. 'Let me know if you'd rather not receive these.')." ;
      const prompt = `Draft a relationship check-in ${channel} to ${contact.name} (${contact.country || ""}, ${kind === "supplier" ? contact.product : contact.industry}). They are an existing ${kind} contact — this is NOT a first pitch, it's a friendly touch-base to stay top of mind. Broker focus: ${p.focus || "bulk trade"}. Sign off: "${p.signoff || "Trade Operations"}". Under 100 words, no hard sell. Include a brief, natural opt-out line. Return JSON: { "subject": "", "body": "" }`;
      const data = await callClaude([{ role:"user", content: prompt }], sys);
      const r = parseJSON(data.text);
      const row = {
        user_id: uid, agent: "Relationship AI", channel,
        recipient_type: kind, recipient_name: contact.name,
        to_addr, subject: r.subject || "Checking in", body: appendVerifyLine(r.body || "", channel), rationale: "Relationship check-in", status: "pending",
      };
      const { data: q } = await supabase.from("queue").insert(row).select().single();
      if (q) setQueue(prev => [q, ...prev]);
      await logFeed(`💬 Check-in drafted for ${contact.name} — awaiting approval`, T.blue);
      notify(`Check-in drafted for ${contact.name} ✓`);
    } catch (e) {
      await logFeed(`⚠️ Check-in draft error for ${contact.name}: ${e.message}`, T.red);
      notify("Check-in draft failed", "error");
    }
  };

  // Toggle a contact's Do Not Contact flag. Requires a `dnc` boolean column on
  // the buyers/suppliers tables — see setup note below if this errors.
  const toggleDnc = async (contact, kind) => {
    const next = !contact.dnc;
    const table = kind === "supplier" ? "suppliers" : "buyers";
    const { error } = await supabase.from(table).update({ dnc: next }).eq("id", contact.id);
    if (error) {
      notify("Couldn't save — your database needs a 'dnc' column on this table (see setup note).", "error");
      return;
    }
    if (kind === "supplier") setSuppliers(prev => prev.map(x => x.id===contact.id ? {...x, dnc: next} : x));
    else setBuyers(prev => prev.map(x => x.id===contact.id ? {...x, dnc: next} : x));
    notify(next ? `${contact.name} marked Do Not Contact` : `${contact.name} re-enabled for contact`);
  };

  // Days since last message SENT to a given contact (by matching to_addr against
  // the sent log). Returns null if never contacted OR if the data is malformed
  // (defensive — avoids "Invalid Date"/NaN breaking the Contacts tab).
  const daysSinceContact = (contact) => {
    const addr = contact.email || contact.phone;
    if (!addr) return null;
    const matches = sent.filter(m => m.to_addr === addr && m.sent_at && !isNaN(new Date(m.sent_at).getTime()));
    if (!matches.length) return null;
    const latest = matches.reduce((a, b) => new Date(a.sent_at) > new Date(b.sent_at) ? a : b);
    const diffMs = Date.now() - new Date(latest.sent_at).getTime();
    if (!isFinite(diffMs) || diffMs < 0) return null;
    return Math.floor(diffMs / 86400000);
  };

  // Color + label for a "days since contact" badge
  const contactHealthBadge = (days) => {
    if (days === null) return { label: "Never contacted", color: T.dim };
    if (days <= 13) return { label: `Contacted ${days}d ago`, color: T.green };
    if (days <= 30) return { label: `${days}d since contact`, color: T.amber };
    return { label: `${days}d — going cold`, color: T.red };
  };


  const runAutopilot = async () => {
    if (busy) return;
    setBusy("auto");
    await logFeed("⚡ AI team cycle started…", T.amber);
    try {
      await runLeadFinderInline();
      // propose opportunities — Deal Maker AI now picks REAL buyer+supplier
      // pairs by ID, not just prose. Each opportunity is a genuine link
      // between two contacts, not a text description with no connection to
      // either party.
      if (buyers.length && suppliers.length) {
        const buyerList = buyers.slice(0,15).map(b=>({id:b.id,name:b.name,country:b.country,industry:b.industry}));
        const supplierList = suppliers.slice(0,15).map(s=>({id:s.id,name:s.name,country:s.country,product:s.product}));
        const sys = "You are Deal Maker AI. Match a specific buyer to a specific supplier from the provided lists and propose a concrete trade opportunity. You MUST use the exact 'id' values given — never invent an id. Return only JSON.";
        const prompt = `Buyers: ${JSON.stringify(buyerList)}
Suppliers: ${JSON.stringify(supplierList)}
Focus: ${p.focus || "bulk trade"}.
Propose up to 3 opportunities, each pairing ONE buyer id with ONE supplier id from the lists above. JSON: { "opportunities": [{ "buyer_id":"", "supplier_id":"", "title":"", "type":"Trade Deal", "value":0, "commission":0, "confidence":70, "risk":"Medium", "rationale":"" }] }`;
        const data = await callClaude([{ role:"user", content: prompt }], sys);
        const parsed = parseJSON(data.text);
        const buyerIds = new Set(buyerList.map(b=>b.id));
        const supplierIds = new Set(supplierList.map(s=>s.id));
        // Defensive: only accept pairs where BOTH ids genuinely exist in the
        // lists we sent — protects against a hallucinated id ever reaching
        // the database and silently producing an unlinked "deal".
        const rows = (parsed.opportunities||[])
          .filter(o => buyerIds.has(o.buyer_id) && supplierIds.has(o.supplier_id))
          .map(o => ({
            user_id: uid, title:o.title, type:o.type||"Trade Deal", status:"New",
            value:Number(o.value)||0, commission:Number(o.commission)||0,
            confidence:Number(o.confidence)||70, risk:o.risk||"Medium", effort:"Medium", notes:o.rationale||"",
            buyer_id:o.buyer_id, supplier_id:o.supplier_id,
          }));
        if (rows.length) {
          const { data: ins } = await supabase.from("opportunities").insert(rows).select();
          setOpps(prev => [...(ins||[]), ...prev]);
          await logFeed(`💡 Deal Maker matched ${rows.length} real buyer↔supplier pair(s)`, T.purple);
          for (const op of (ins||[])) { draftDealContracts(op); }
        }
      }
      await logFeed("✅ Cycle complete", T.green);
      notify("AI team cycle complete");
    } catch (e) {
      await logFeed(`⚠️ Cycle error: ${e.message}`, T.red);
      notify("Autopilot error", "error");
    } finally { setBusy(""); }
  };
  // inline lead finder (no tab switch / own busy)
  const runLeadFinderInline = async () => {
    try {
      const existing = [...buyers.map(b=>b.name), ...suppliers.map(s=>s.name), ...leads.map(l=>l.name)];
      const found = await findLeads({ focus: p.focus, market: p.market, existing });
      const rows = found.map(l => ({ user_id: uid, kind:l.kind||"buyer", name:l.name, country:l.country||"", sector:l.sector||"", product:l.product||"", email:l.email||"", phone:l.phone||"", website:l.website||"", why_fit:l.why_fit||"", status:"proposed" }));
      if (rows.length) { const { data } = await supabase.from("leads").insert(rows).select(); setLeads(prev => [...(data||[]), ...prev]); await logFeed(`✨ ${rows.length} new candidates proposed`, T.cyan); }
    } catch (e) { await logFeed(`⚠️ Lead search: ${e.message}`, T.red); }
  };

  useEffect(() => {
    if (!autoOn) return;
    const iv = setInterval(() => { if (!busy) runAutopilot(); }, 120000);
    return () => clearInterval(iv);
  }, [autoOn, busy, buyers, suppliers, leads]); // eslint-disable-line

  // ── APPROVE / DECLINE messages ──
  // FIXED: sends now route through /api/send-email and /api/send-sms (serverless
  // relays) instead of calling Resend/Twilio directly from the browser, which
  // was blocked by CORS and caused "Send failed — kept in queue" errors.
  const approveMsg = async (item) => {
    const useReal = item.channel === "email" ? emailReady : smsReady;
    let delivery = "handoff";
    if (useReal && item.to_addr) {
      try {
        if (item.channel === "email") {
          const r = await fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: item.to_addr,
              subject: item.subject,
              body: item.body,
              resendKey: p.resend_key,
              fromEmail: `${p.signoff || "Trade Desk"} <${p.from_email}>`,
            }),
          });
          if (!r.ok) throw new Error(await readErrorMessage(r));
        } else {
          const r = await fetch("/api/send-sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: item.to_addr,
              body: item.body,
              twilioSid: p.twilio_sid,
              twilioToken: p.twilio_token,
              twilioFrom: p.twilio_from,
            }),
          });
          if (!r.ok) throw new Error(await readErrorMessage(r));
        }
        delivery = "sent";
        await logFeed(`📤 ${item.channel} sent to ${item.recipient_name}`, T.green);
        notify(`Sent to ${item.recipient_name} ✓`);
      } catch (e) {
        await logFeed(`⚠️ Send failed: ${e.message}`, T.red);
        notify("Send failed — kept in queue. " + (item.channel==="email"?"Resend":"Twilio")+" may need a serverless relay.", "error");
        return;
      }
    } else if (item.to_addr) {
      const href = item.channel === "email"
        ? `mailto:${item.to_addr}?subject=${encodeURIComponent(item.subject)}&body=${encodeURIComponent(item.body)}`
        : `sms:${item.to_addr}?body=${encodeURIComponent(item.body)}`;
      window.open(href, "_blank");
      await logFeed(`📲 Approved — opened ${item.channel} app for ${item.recipient_name}`, T.blue);
      notify(`Approved — opened ${item.channel} app`);
    }
    // move to sent, remove from queue (explicit sent_at so this doesn't depend
    // on the DB column having a default — fixes "Invalid Date" / broken
    // days-since-contact calculations if the schema lacks one)
    await supabase.from("sent").insert({ user_id: uid, channel:item.channel, recipient_name:item.recipient_name, to_addr:item.to_addr, subject:item.subject, body:item.body, delivery, sent_at: new Date().toISOString() });
    await supabase.from("queue").delete().eq("id", item.id);
    setQueue(prev => prev.filter(q => q.id!==item.id));
    loadAll();
    // FIXED: previously this ran for every approved message (including
    // relationship check-ins), silently advancing an unrelated opportunity —
    // sometimes all the way to "Won", auto-booking a fake commission and
    // generating a real invoice from nothing. Now it only runs for genuine
    // deal outreach, never for check-ins.
    if (item.agent === "Outreach AI" && item.opportunity_id) advanceDeal(item.opportunity_id);
  };
  const declineMsg = async (item) => {
    await supabase.from("queue").delete().eq("id", item.id);
    setQueue(prev => prev.filter(q => q.id!==item.id));
    await logFeed(`✗ Declined message to ${item.recipient_name}`, T.muted);
  };
  const regenMsg = async (item) => {
    try {
      const data = await callClaude([{ role:"user", content:`Rewrite this ${item.channel} to ${item.recipient_name} with a fresh angle, under 130 words, sign off "${p.signoff||"Trade Operations"}". Return JSON: { "subject":"", "body":"" }` }], "You are Outreach AI. Return only JSON.");
      const r = parseJSON(data.text);
      const newBody = appendVerifyLine(r.body || item.body, item.channel);
      await supabase.from("queue").update({ subject:r.subject||item.subject, body:newBody }).eq("id", item.id);
      setQueue(prev => prev.map(q => q.id===item.id ? {...q, subject:r.subject||q.subject, body:newBody} : q));
      notify("Regenerated ✓");
    } catch { notify("Regen failed", "error"); }
  };

  const STAGE_NEXT = { New:"Evaluating", Evaluating:"Active", Active:"Closing", Closing:"Won" };
  const advanceDeal = async (opportunityId) => {
    const target = opps.find(o => o.id === opportunityId && !["Won","Lost"].includes(o.status));
    if (!target) return;
    const ns = STAGE_NEXT[target.status] || target.status;
    await supabase.from("opportunities").update({ status: ns }).eq("id", target.id);
    setOpps(prev => prev.map(o => o.id===target.id ? {...o, status:ns} : o));
    if (ns === "Won" && target.commission > 0) {
      await bookEarning(target);
    } else { await logFeed(`📈 ${target.title} advanced to ${ns}`, T.blue); }
  };

  const bookEarning = async (op) => {
    await supabase.from("earnings").insert({ user_id: uid, title: op.title, amount: Number(op.commission) });
    await logFeed(`💰 ${op.title} won — ${fmtMoney(op.commission, cur)} booked`, T.green);
    loadAll();
    generateInvoice(op);
  };
  const closeWon = async (op) => {
    await supabase.from("opportunities").update({ status:"Won" }).eq("id", op.id);
    setOpps(prev => prev.map(o => o.id===op.id ? {...o, status:"Won"} : o));
    if (op.commission > 0) { await bookEarning(op); notify(`Commission booked ✓`); }
  };

  // ── DEAL CONTRACTS: draft + send to BOTH the buyer and supplier ──
  // Called automatically right after Deal Maker AI links a real buyer to a
  // real supplier. Drafts one Sales/Commission Contract with Claude, saves
  // it as a document, then queues TWO separate outreach messages — one to
  // the buyer, one to the supplier — each referencing the contract and
  // asking them to review and sign. Nothing sends without your approval,
  // same as every other message in this app.
  const draftDealContracts = async (op) => {
    const buyer = buyers.find(b => b.id === op.buyer_id);
    const supplier = suppliers.find(s => s.id === op.supplier_id);
    if (!buyer || !supplier) {
      await logFeed(`⚠️ Could not draft contract for "${op.title}" — buyer or supplier record not found locally.`, T.red);
      return;
    }
    if (buyer.dnc || supplier.dnc) {
      await logFeed(`🚫 Skipped contract for "${op.title}" — ${buyer.dnc ? buyer.name : supplier.name} is marked Do Not Contact.`, T.red);
      return;
    }
    try {
      const prompt = `Draft a Sales / Purchase Contract for a South African trade brokerage facilitating a deal between two named parties.
Broker: ${p.legal_name||"[Broker]"}, Reg ${p.reg_no||"[Reg]"}, ${p.address||""}, ${p.city}, ${p.province}, ${p.country}. Contact ${p.biz_email||""} ${p.biz_phone||""}. Commission ${p.commission_rate||"5"}%.
Buyer: ${buyer.name} (${buyer.country}). Supplier: ${supplier.name} (${supplier.country}).
Deal: ${op.title}. Value: ${fmtMoney(op.value, cur)}. Commission: ${fmtMoney(op.commission, cur)}.
Governing law: South Africa (reference ECTA for e-signatures, POPIA for data where relevant).
Include all standard clauses (goods, price, Incoterms, delivery, payment terms), numbered, with signature blocks for BOTH named parties. Start with: "TEMPLATE — review with a qualified South African attorney before signing." Return ONLY the document text.`;
      const data = await callClaude([{ role:"user", content: prompt }], "You are a contracts drafting assistant for a South African trade broker. Output clean document text only.", { maxTokens: 2500 });
      const { data: doc } = await supabase.from("documents").insert({
        user_id: uid, type:"Sales Contract",
        title:`Sales Contract — ${buyer.name} × ${supplier.name}`,
        content:data.text, counterparty:`${buyer.name} / ${supplier.name}`, opp_title:op.title,
      }).select().single();
      if (doc) setDocs(d => [doc, ...d]);

      await supabase.from("opportunities").update({ contract_doc_id: doc?.id || null }).eq("id", op.id);
      setOpps(prev => prev.map(o => o.id===op.id ? {...o, contract_doc_id: doc?.id} : o));

      const sys = "You are Outreach AI for a trade broker. Write a concise, professional message asking a party to review and sign an attached contract. Written only. No profit guarantees. Sign off with the broker's sign-off.";
      const draftFor = async (party, otherPartyName, role) => {
        const channel = party.email ? "email" : (party.phone ? "sms" : "email");
        const prompt2 = `Draft a ${channel} to ${party.name}, our ${role}, letting them know the Sales Contract for "${op.title}" with ${otherPartyName} is ready for their review and signature. Broker sign-off: "${p.signoff || "Trade Operations"}". Under 120 words. Return JSON: { "subject":"", "body":"" }`;
        const d2 = await callClaude([{ role:"user", content: prompt2 }], sys);
        const r2 = parseJSON(d2.text);
        const row = {
          user_id: uid, agent: "Outreach AI", channel,
          recipient_type: role, recipient_name: party.name,
          to_addr: channel==="sms" ? (party.phone||"") : (party.email||""),
          subject: r2.subject || `Contract ready — ${op.title}`,
          body: r2.body || "", rationale: `Contract for opportunity: ${op.title}`,
          status: "pending", opportunity_id: op.id,
        };
        const { data: q } = await supabase.from("queue").insert(row).select().single();
        if (q) setQueue(prev => [q, ...prev]);
      };
      await draftFor(buyer, supplier.name, "buyer");
      await draftFor(supplier, buyer.name, "supplier");

      await logFeed(`📄 Contract drafted for "${op.title}" — sent to both ${buyer.name} and ${supplier.name} for approval`, T.pink);
    } catch (e) {
      await logFeed(`⚠️ Contract draft error for "${op.title}": ${e.message}`, T.red);
    }
  };

  // ── SIGNATURE CONFIRMATION (manual — no e-signature service is connected) ──
  // You mark each side once you've actually received their signed
  // agreement back. Only when BOTH are true does the deal seal itself:
  // status flips to Won, commission books, invoice generates.
  const markSigned = async (op, side) => {
    const patch = side === "buyer" ? { buyer_signed: true } : { supplier_signed: true };
    await supabase.from("opportunities").update(patch).eq("id", op.id);
    const updated = { ...op, ...patch };
    setOpps(prev => prev.map(o => o.id===op.id ? updated : o));
    await logFeed(`✍️ ${side === "buyer" ? "Buyer" : "Supplier"} signature confirmed for "${op.title}"`, T.blue);

    if (updated.buyer_signed && updated.supplier_signed) {
      await supabase.from("opportunities").update({ status:"Won" }).eq("id", op.id);
      setOpps(prev => prev.map(o => o.id===op.id ? {...o, status:"Won"} : o));
      await logFeed(`🤝 Both sides signed — "${op.title}" sealed`, T.green);
      if (Number(op.commission) > 0) { await bookEarning({ ...op, ...patch }); notify(`Deal sealed — commission booked ✓`); }
    }
  };

  // ── INVOICES & DOCS ──
  const nextInvoiceNo = () => `INV-${new Date().getFullYear()}-${String(docs.filter(d=>d.type==="Invoice").length+1).padStart(4,"0")}`;
  const generateInvoice = async (op, party=null) => {
    const no = nextInvoiceNo();
    const today = new Date(); const due = new Date(today.getTime()+14*864e5);
    const amount = Number(op?.commission)||0;
    const content =
`COMMISSION INVOICE

Invoice No:    ${no}
Date:          ${today.toLocaleDateString("en-ZA")}
Due Date:      ${due.toLocaleDateString("en-ZA")} (14 days)

────────────────────────────────────────────
FROM (Broker)
${p.legal_name || "[Your Registered Business Name]"}
${p.address || "[Business Address]"}
${p.city || "Johannesburg"}, ${p.province || "Gauteng"}, ${p.country || "South Africa"}
${p.reg_no ? "Company Reg: "+p.reg_no : ""}
${p.vat_no ? "VAT No: "+p.vat_no : ""}
${p.biz_email || ""}   ${p.biz_phone || ""}

BILL TO
${party?.name || "[Counterparty Name]"}
${party?.country || ""}
${party?.email || ""}
────────────────────────────────────────────

DESCRIPTION                                    AMOUNT
Brokerage commission for facilitating:
"${op?.title || "Trade transaction"}"
Deal value: ${fmtMoney(op?.value, cur)}
Commission rate: ${p.commission_rate || "—"}%
                                               ${fmtMoney(amount, cur)}

────────────────────────────────────────────
                         TOTAL DUE:  ${fmtMoney(amount, cur)}
────────────────────────────────────────────

PAYMENT DETAILS (International Wire / SWIFT)
Bank:            ${p.bank_name || "[Bank Name]"}
Branch:          ${p.bank_branch || ""}
Account Name:    ${p.account_name || p.legal_name || "[Account Name]"}
Account No:      ${p.account_no || "[Account Number]"}
Branch Code:     ${p.branch_code || ""}
SWIFT / BIC:     ${p.swift || "[SWIFT/BIC]"}
${p.iban ? "IBAN:            "+p.iban : ""}
Currency:        ${cur}
Payment reason:  Brokerage commission (services rendered)

Please quote the invoice number as payment reference and the
relevant SARB BoP category for commission/services.

Thank you for your business.
${p.legal_name || ""}`;
    const { data } = await supabase.from("documents").insert({ user_id: uid, type:"Invoice", title:`Commission Invoice — ${op?.title||"Deal"}`, content, invoice_no:no, amount, opp_title:op?.title }).select().single();
    if (data) setDocs(d => [data, ...d]);
    await logFeed(`🧾 Invoice ${no} generated`, T.pink);
    notify(`Invoice ${no} created ✓`);
  };

  const DOC_TYPES = [
    { key:"NDA", label:"Non-Disclosure Agreement", desc:"Confidentiality before sharing details.", color:T.cyan },
    { key:"Commission Agreement", label:"Commission Agreement", desc:"Your fee, when earned, how paid.", color:T.amber },
    { key:"Payment Agreement", label:"Payment Agreement", desc:"Terms, schedule, banking, late fees.", color:T.green },
    { key:"Sales Contract", label:"Sales / Purchase Contract", desc:"Goods, price, Incoterms, delivery.", color:T.purple },
    { key:"Agency Agreement", label:"Agency Agreement", desc:"Authority to represent in a territory.", color:T.blue },
    { key:"LOI", label:"Letter of Intent", desc:"Non-binding intent to proceed.", color:T.orange },
    { key:"Proforma Invoice", label:"Proforma Invoice", desc:"Pre-deal quote for buyer funding.", color:T.pink },
    { key:"Service Agreement", label:"Broker Service Agreement", desc:"Scope of your services.", color:T.cyan },
  ];
  const generateLegalDoc = async (docType, counterparty="", oppTitle="") => {
    setBusy("doc:"+docType.key);
    try {
      const prompt = `Draft a professional ${docType.label} for a South African trade brokerage.
Broker: ${p.legal_name||"[Broker]"}, Reg ${p.reg_no||"[Reg]"}, ${p.address||""}, ${p.city}, ${p.province}, ${p.country}. Contact ${p.biz_email||""} ${p.biz_phone||""}. Commission ${p.commission_rate||"5"}%.
Counterparty: ${counterparty||"[Counterparty]"}. ${oppTitle?`Deal: ${oppTitle}.`:""}
Governing law: South Africa (reference ECTA for e-signatures, POPIA for data where relevant).
Include all standard clauses for a ${docType.key}, numbered, with [BRACKETED PLACEHOLDERS] for unknowns, and signature blocks for both parties. Start with: "TEMPLATE — review with a qualified South African attorney before signing." Return ONLY the document text.`;
      const data = await callClaude([{ role:"user", content: prompt }], "You are a contracts drafting assistant for a South African trade broker. Output clean document text only.", { maxTokens: 2500 });
      const { data: row } = await supabase.from("documents").insert({ user_id: uid, type:docType.key, title:`${docType.label}${counterparty?" — "+counterparty:""}`, content:data.text, counterparty }).select().single();
      if (row) setDocs(d => [row, ...d]);
      await logFeed(`📄 ${docType.label} drafted`, docType.color);
      notify(`${docType.key} drafted ✓`);
    } catch (e) { notify("Doc generation failed", "error"); }
    finally { setBusy(""); }
  };
  const delDoc = async (id, title) => {
    if (!window.confirm(`Delete "${title || "this document"}"? This cannot be undone.`)) return;
    await supabase.from("documents").delete().eq("id", id); setDocs(d=>d.filter(x=>x.id!==id));
    notify("Document deleted", "info");
  };
  const downloadDoc = (doc) => {
    const blob = new Blob([doc.content], { type:"text/plain" }); const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`${(doc.invoice_no||doc.type||"document").replace(/\s+/g,"-")}.txt`; a.click(); URL.revokeObjectURL(url);
  };
  const copyDoc = async (doc) => { try { await navigator.clipboard.writeText(doc.content); notify("Copied ✓"); } catch { notify("Copy failed","error"); } };

  // briefing
  const runBriefing = async () => {
    setBusy("brief");
    try {
      const data = await callClaude([{ role:"user", content:`Executive briefing (4-5 sentences) for my trade broker operation. Data: ${JSON.stringify({ buyers:buyers.length, suppliers:suppliers.length, opps:opps.length, totalPipeline, bookedEarnings, pendingLeads:pendingLeads.length, queue:queue.length })}. Focus: ${p.focus||"bulk trade"}.` }], "You are CEO AI. Sharp, actionable briefings.");
      setBriefing(data.text);
    } catch { setBriefing("CEO AI unavailable."); }
    finally { setBusy(""); }
  };

  // settings save
  const saveProfile = async (patch) => {
    await supabase.from("profiles").update(patch).eq("id", uid);
    await refreshProfile();
    notify("Saved ✓");
  };

  // CRUD for contacts (manual still allowed but optional)
  const delBuyer = async (id, name) => {
    if (!window.confirm(`Delete buyer "${name || "this contact"}"? This cannot be undone.`)) return;
    await supabase.from("buyers").delete().eq("id", id); setBuyers(b=>b.filter(x=>x.id!==id));
    notify("Buyer deleted", "info");
  };
  const delSupplier = async (id, name) => {
    if (!window.confirm(`Delete supplier "${name || "this contact"}"? This cannot be undone.`)) return;
    await supabase.from("suppliers").delete().eq("id", id); setSuppliers(s=>s.filter(x=>x.id!==id));
    notify("Supplier deleted", "info");
  };
  const delOpp = async (id, title) => {
    if (!window.confirm(`Delete opportunity "${title || "this deal"}"? This cannot be undone.`)) return;
    await supabase.from("opportunities").delete().eq("id", id); setOpps(o=>o.filter(x=>x.id!==id));
    notify("Opportunity deleted", "info");
  };

  const navBadges = { leads: pendingLeads.length, approvals: queue.length };

  // ── RENDER ──
  return (
    <ErrorBoundary>
    <div className="flex h-screen overflow-hidden" style={{ background: T.bg, fontFamily:"'Inter', system-ui, sans-serif", color: T.text }}>
      {toast && (
        <div className="fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{ background:(toast.type==="error"?T.red:T.green)+"22", color:toast.type==="error"?T.red:T.green, border:`1px solid ${(toast.type==="error"?T.red:T.green)}33`, backdropFilter:"blur(12px)" }}>{toast.msg}</div>
      )}

      {/* SIDEBAR */}
      <div className="flex-shrink-0 flex flex-col transition-all duration-300 z-30" style={{ width: sideOpen?220:56, background:"#06070d", borderRight:`1px solid ${T.border}` }}>
        <div className="flex items-center gap-3 px-3 py-4 border-b" style={{ borderColor: T.border }}>
          <Logo />
          {sideOpen && <div className="flex-1 min-w-0"><div className="text-xs font-black text-white leading-none">OPPORTUNITY</div><div className="text-xs font-black leading-none" style={{ color:T.amber }}>COMMAND AI</div></div>}
          <button onClick={()=>setSideOpen(v=>!v)} style={{ color:T.dim }}><SVG d={sideOpen?IC.x:IC.menu} size={15} /></button>
        </div>
        <nav className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto">
          {NAV.map(item => {
            const active = tab===item.id; const badge = navBadges[item.id]||0;
            return (
              <button key={item.id} onClick={()=>setTab(item.id)} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left w-full relative"
                style={active?{ background:item.color+"18", color:item.color, border:`1px solid ${item.color}25` }:{ color:T.muted, border:"1px solid transparent" }}>
                <span className="relative flex-shrink-0"><SVG d={item.icon} size={14} />
                  {badge>0 && <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full flex items-center justify-center font-bold" style={{ background:T.orange, color:"white", fontSize:8 }}>{badge}</span>}
                </span>
                {sideOpen && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        {sideOpen && (
          <div className="p-3 border-t" style={{ borderColor: T.border }}>
            <div className="text-xs px-2 py-1.5 rounded-lg text-center font-semibold mb-2" style={{ background:(autoOn?T.green:T.dim)+"15", color:autoOn?T.green:T.muted, border:`1px solid ${(autoOn?T.green:T.dim)}25` }}>{autoOn?"🟢 Autopilot looping":"⚪ Autopilot idle"}</div>
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-1.5 text-xs px-2 py-1.5 rounded-lg" style={{ color:T.muted, background:T.surface }}><SVG d={IC.logout} size={12} />Log out</button>
          </div>
        )}
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-3 border-b flex-shrink-0" style={{ background:"#06070d", borderColor:T.border }}>
          <div className="flex-1 text-sm font-bold text-white truncate">Welcome, {p.owner_name || "Commander"}</div>
          <Btn onClick={()=>runLeadFinder()} disabled={!!busy} sm color={T.cyan}><SVG d={IC.search} size={12} />{busy==="leads"?"Searching…":"Find Leads"}</Btn>
          <Btn onClick={runAutopilot} disabled={!!busy} sm color={T.amber}><SVG d={IC.bolt} size={12} />{busy==="auto"?"Working…":"Run AI Team"}</Btn>
          <button onClick={()=>setTab("approvals")} className="relative" style={{ color:T.muted }}><SVG d={IC.inbox} size={18} />{queue.length>0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold" style={{ background:T.orange, color:"white", fontSize:8 }}>{queue.length}</span>}</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* DASHBOARD */}
          {tab==="dashboard" && (
            <div className="flex flex-col gap-6 max-w-5xl mx-auto">
              <div><h1 className="text-2xl font-black text-white">Good day, {p.owner_name || "Commander"}.</h1><p className="text-sm mt-1" style={{ color:T.muted }}>Your AI team finds leads and drafts outreach. You approve or decline — nothing happens without you.</p></div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Metric label="Booked Earnings" value={bookedEarnings?`${cur} ${(bookedEarnings/1000).toFixed(1)}K`:`${cur} 0`} sub="Commission won" accent={T.green} icon={IC.wallet} />
                <Metric label="Leads to Review" value={pendingLeads.length} sub="AI-proposed" accent={T.cyan} icon={IC.search} />
                <Metric label="Messages to Approve" value={queue.length} sub="Drafted" accent={T.orange} icon={IC.inbox} />
                <Metric label="Active Deals" value={activeDeals} sub="In motion" accent={T.blue} icon={IC.opp} />
              </div>
              <div className="rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4" style={{ background:T.card, border:`1px solid ${T.cyan}30` }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:T.cyan+"18" }}><SVG d={IC.search} size={20} style={{ color:T.cyan }} /></div>
                <div className="flex-1"><div className="text-sm font-bold text-white">AI Lead Finder</div><p className="text-xs mt-0.5" style={{ color:T.muted }}>Searches the web for buyer & supplier candidates matching your focus: <span style={{ color:T.cyan }}>{p.focus || "Broad bulk trade"}</span></p></div>
                <Btn onClick={()=>runLeadFinder()} disabled={!!busy} color={T.cyan} sm><SVG d={IC.search} size={12} />{busy==="leads"?"Searching…":"Find Leads"}</Btn>
              </div>
              <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background:T.card, border:`1px solid ${T.amber}30` }}>
                <div className="flex items-center justify-between"><div className="flex items-center gap-2"><SVG d={IC.ceo} size={15} style={{ color:T.amber }} /><span className="text-sm font-semibold text-white">CEO AI — Briefing</span></div><Btn onClick={runBriefing} disabled={!!busy} color={T.amber} sm><SVG d={IC.refresh} size={12} />{busy==="brief"?"…":"Refresh"}</Btn></div>
                {briefing ? <p className="text-sm leading-relaxed" style={{ color:T.text }}>{briefing}</p> : <p className="text-sm italic" style={{ color:T.muted }}>Click Refresh for your executive briefing.</p>}
              </div>
              {!emailReady && !smsReady && (
                <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background:T.blue+"0d", border:`1px solid ${T.blue}30` }}>
                  <SVG d={IC.key} size={14} style={{ color:T.blue, flexShrink:0, marginTop:2 }} />
                  <div className="text-xs leading-relaxed flex-1" style={{ color:T.muted }}><span className="font-semibold" style={{ color:T.blue }}>Connect sending to auto-deliver. </span>Without your own email/SMS keys, approving opens your device's app instead. Add them in Settings → Integrations.</div>
                  <Btn onClick={()=>setTab("settings")} color={T.blue} sm>Set up</Btn>
                </div>
              )}
            </div>
          )}

          {/* AUTOPILOT */}
          {tab==="autopilot" && (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div><h1 className="text-2xl font-black text-white">AI Autopilot</h1><p className="text-sm mt-1" style={{ color:T.muted }}>Your autonomous team. It works, you approve.</p></div>
                <div className="flex gap-2"><Btn onClick={runAutopilot} disabled={!!busy} color={T.amber}><SVG d={IC.bolt} size={14} />{busy==="auto"?"Working…":"Run One Cycle"}</Btn><Btn onClick={()=>setAutoOn(v=>!v)} color={autoOn?T.red:T.green}><SVG d={autoOn?IC.pause:IC.play} size={14} />{autoOn?"Stop Loop":"Start Loop"}</Btn></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Metric label="Leads Queued" value={pendingLeads.length} sub="To review" accent={T.cyan} icon={IC.search} />
                <Metric label="Messages Queued" value={queue.length} sub="To approve" accent={T.orange} icon={IC.inbox} />
                <Metric label="Opportunities" value={opps.length} sub="Tracked" accent={T.purple} icon={IC.opp} />
                <Metric label="Earnings" value={bookedEarnings?`${cur} ${(bookedEarnings/1000).toFixed(1)}K`:`${cur} 0`} sub="Booked" accent={T.green} icon={IC.wallet} />
              </div>
              <div className="rounded-2xl p-4" style={{ background:T.card, border:`1px solid ${autoOn?T.green:T.border}` }}>
                <div className="flex items-center gap-2 mb-1"><div className={`w-2 h-2 rounded-full ${autoOn?"animate-pulse":""}`} style={{ background:autoOn?T.green:T.dim }} /><span className="text-sm font-semibold text-white">{autoOn?"Loop active — cycles every 2 minutes":"Loop stopped"}</span></div>
                <p className="text-xs leading-relaxed" style={{ color:T.muted }}>When looping, the team finds leads and proposes deals continuously. Leads and messages still wait for your approval — nothing is sent or added on its own.</p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3"><SVG d={IC.sparkle} size={14} style={{ color:T.amber }} /><h2 className="text-sm font-bold text-white">Team Activity</h2></div>
                {feed.length===0 ? <Empty icon={IC.bolt} title="No activity yet" sub="Run a cycle to put your AI team to work." action="Run AI Team" onAction={runAutopilot} />
                  : <div className="flex flex-col gap-2">{feed.map(f => (
                      <div key={f.id} className="flex items-start gap-3 rounded-xl px-4 py-2.5" style={{ background:T.card, border:`1px solid ${T.border}` }}>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background:f.color }} />
                        <div className="flex-1 text-xs leading-relaxed" style={{ color:T.text }}>{f.text}</div>
                        <div className="text-xs flex-shrink-0" style={{ color:T.dim }}>{new Date(f.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                    ))}</div>}
              </div>
            </div>
          )}

          {/* LEAD APPROVALS */}
          {tab==="leads" && (
            <div className="flex flex-col gap-5 max-w-3xl mx-auto">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div><h1 className="text-2xl font-black text-white">Lead Approvals</h1><p className="text-sm mt-1" style={{ color:T.muted }}>Candidates the AI found. Approve to add them and let the AI draft outreach, or decline.</p></div>
                <Btn onClick={()=>runLeadFinder()} disabled={!!busy} color={T.cyan} sm><SVG d={IC.search} size={12} />{busy==="leads"?"Searching…":"Find More"}</Btn>
              </div>
              <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background:T.card, border:`1px solid ${T.cyan}30` }}>
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color:T.cyan }}>Search anything, right now</div>
                <p className="text-xs leading-relaxed" style={{ color:T.muted }}>Type any product or market — "solar panels", "building materials", "grass" — no need to touch Settings. Leave blank to use your saved default focus.</p>
                <div className="flex gap-2">
                  <input value={quickFocus} onChange={e=>setQuickFocus(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!busy&&runLeadFinder(quickFocus)}
                    placeholder={p.focus || "e.g. solar panels, South Africa"}
                    className="flex-1 text-sm rounded-xl px-3 py-2.5 outline-none placeholder-slate-600" style={{ background:T.surface, border:`1px solid ${T.border}`, color:T.text }} />
                  <Btn onClick={()=>runLeadFinder(quickFocus)} disabled={!!busy} color={T.cyan} sm>{busy==="leads"?"Searching…":"Search Now"}</Btn>
                </div>
              </div>
              <div className="p-4 rounded-2xl flex items-start gap-3" style={{ background:T.card, border:`1px solid ${T.cyan}30` }}>
                <SVG d={IC.search} size={14} style={{ color:T.cyan, flexShrink:0, marginTop:2 }} />
                <div className="text-xs leading-relaxed" style={{ color:T.muted }}><span className="font-semibold" style={{ color:T.cyan }}>These are researched candidates, not confirmed buyers. </span>The AI found companies that fit your focus and pulled public details. Verify before relying on them — your approval is the safeguard.</div>
              </div>
              {pendingLeads.length===0 ? <Empty icon={IC.search} title="No leads waiting" sub="Run the Lead Finder to discover buyer & supplier candidates." action="Find Leads" onAction={()=>runLeadFinder()} />
                : <div className="flex flex-col gap-3">{pendingLeads.map(lead => (
                    <div key={lead.id} className="rounded-2xl p-4 flex flex-col gap-3" style={{ background:T.card, border:`1px solid ${T.cyan}33` }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1"><Pill label={lead.kind==="supplier"?"Supplier":"Buyer"} color={lead.kind==="supplier"?T.green:T.blue} /><span className="text-sm font-bold text-white">{lead.name}</span></div>
                          <div className="text-xs" style={{ color:T.muted }}>{lead.country}{lead.sector?` · ${lead.sector}`:""}{lead.product?` · ${lead.product}`:""}</div>
                        </div>
                      </div>
                      {lead.why_fit && <p className="text-xs leading-relaxed" style={{ color:T.muted }}><span style={{ color:T.dim }}>Why it fits: </span>{lead.why_fit}</p>}
                      <div className="flex flex-col gap-1">
                        {lead.website && <a href={lead.website.startsWith("http")?lead.website:`https://${lead.website}`} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1.5" style={{ color:T.cyan }}><SVG d={IC.arrow} size={11} />{lead.website}</a>}
                        {lead.email && <div className="text-xs flex items-center gap-1.5" style={{ color:T.dim }}><SVG d={IC.mail} size={11} />{lead.email}</div>}
                        {lead.phone && <div className="text-xs flex items-center gap-1.5" style={{ color:T.dim }}><SVG d={IC.msg} size={11} />{lead.phone}</div>}
                      </div>
                      <div className="flex gap-2">
                        <Btn onClick={()=>approveLead(lead)} color={T.green} sm><SVG d={IC.check} size={13} />Approve & Draft Outreach</Btn>
                        <Btn onClick={()=>declineLead(lead)} color={T.red} sm><SVG d={IC.x} size={12} />Decline</Btn>
                      </div>
                    </div>
                  ))}</div>}
            </div>
          )}

          {/* MESSAGE APPROVALS */}
          {tab==="approvals" && (
            <div className="flex flex-col gap-5 max-w-3xl mx-auto">
              <div><h1 className="text-2xl font-black text-white">Message Approvals</h1><p className="text-sm mt-1" style={{ color:T.muted }}>Everything the AI wants to send. Approve to deliver and advance the deal, or decline.</p></div>
              <div className="p-4 rounded-2xl flex items-start gap-3" style={{ background:T.card, border:`1px solid ${T.orange}30` }}>
                <SVG d={IC.lock} size={14} style={{ color:T.orange, flexShrink:0, marginTop:2 }} />
                <div className="text-xs leading-relaxed" style={{ color:T.muted }}><span className="font-semibold" style={{ color:T.orange }}>You are the only sender. </span>{emailReady||smsReady?"Approved messages send through your connected provider.":"No provider connected — approving opens your device's mail/SMS app. Add keys in Settings to auto-send."}</div>
              </div>
              {queue.length===0 ? <Empty icon={IC.inbox} title="Queue is clear" sub="Approve leads to generate outreach, or run the AI team." action="Review Leads" onAction={()=>setTab("leads")} />
                : <div className="flex flex-col gap-3">{queue.map(item => (
                    <div key={item.id} className="rounded-2xl p-4 flex flex-col gap-3" style={{ background:T.card, border:`1px solid ${T.orange}33` }}>
                      <div className="flex items-center gap-2 flex-wrap"><Pill label={item.agent} color={T.orange} /><Pill label={item.channel==="email"?"Email":"SMS"} color={item.channel==="email"?T.blue:T.green} /><span className="text-xs ml-auto" style={{ color:T.dim }}>{new Date(item.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span></div>
                      <div>
                        <div className="text-xs mb-1" style={{ color:T.muted }}>To: <span className="text-white font-semibold">{item.recipient_name}</span>{item.to_addr && <span style={{ color:T.dim }}> · {item.to_addr}</span>}</div>
                        {item.channel==="email" && <div className="text-sm font-bold text-white mb-1">{item.subject}</div>}
                        <div className="text-sm leading-relaxed rounded-xl p-3" style={{ background:T.surface, color:T.text, whiteSpace:"pre-wrap" }}>{item.body}</div>
                      </div>
                      {!item.to_addr && <div className="text-xs px-2 py-1 rounded-lg" style={{ background:T.red+"12", color:T.red }}>⚠ No {item.channel==="email"?"email":"phone"} for this contact.</div>}
                      <div className="flex gap-2 flex-wrap">
                        <Btn onClick={()=>approveMsg(item)} color={T.green} sm><SVG d={IC.check} size={13} />Approve & Send</Btn>
                        <Btn onClick={()=>regenMsg(item)} color={T.orange} sm><SVG d={IC.refresh} size={12} />Regenerate</Btn>
                        <Btn onClick={()=>declineMsg(item)} color={T.red} sm><SVG d={IC.x} size={12} />Decline</Btn>
                      </div>
                    </div>
                  ))}</div>}
            </div>
          )}

          {/* OPPORTUNITIES */}
          {tab==="opportunities" && (
            <div className="flex flex-col gap-5 max-w-5xl mx-auto">
              <h1 className="text-2xl font-black text-white">Opportunities</h1>
              {opps.length===0 ? <Empty icon={IC.opp} title="No opportunities yet" sub="Run the AI team to propose deals from your approved contacts." action="Run AI Team" onAction={runAutopilot} />
                : <div className="flex flex-col gap-3">{opps.map(op => (
                    <div key={op.id} className="rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4" style={{ background:T.card, border:`1px solid ${T.border}` }}>
                      <div className="flex-1 min-w-0"><div className="text-sm font-bold text-white mb-1">{op.title}</div><div className="flex flex-wrap gap-2"><StatusPill status={op.status} /><Pill label={op.type} color={T.purple} /><Pill label={`Risk: ${op.risk}`} color={op.risk==="Low"?T.green:op.risk==="Medium"?T.amber:T.red} /></div>{op.notes && <p className="text-xs mt-2 leading-relaxed" style={{ color:T.muted }}>{op.notes}</p>}
                        {op.buyer_id && op.supplier_id && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <Pill label={op.buyer_signed ? "Buyer ✓ Signed" : "Buyer — Pending"} color={op.buyer_signed?T.green:T.amber} />
                            <Pill label={op.supplier_signed ? "Supplier ✓ Signed" : "Supplier — Pending"} color={op.supplier_signed?T.green:T.amber} />
                            {!op.buyer_signed && <button onClick={()=>markSigned(op,"buyer")} className="text-xs px-2 py-1 rounded-lg" style={{background:T.blue+"18",color:T.blue}}>Confirm buyer signed</button>}
                            {!op.supplier_signed && <button onClick={()=>markSigned(op,"supplier")} className="text-xs px-2 py-1 rounded-lg" style={{background:T.blue+"18",color:T.blue}}>Confirm supplier signed</button>}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-5 flex-shrink-0 flex-wrap">
                        <div><div className="text-xs" style={{ color:T.muted }}>Value</div><div className="font-bold text-white">{op.value?`${cur} ${(op.value/1000).toFixed(0)}K`:"—"}</div></div>
                        <div><div className="text-xs" style={{ color:T.muted }}>Commission</div><div className="font-bold" style={{ color:T.green }}>{op.commission?`+${cur} ${Number(op.commission).toLocaleString()}`:"—"}</div></div>
                        <div><div className="text-xs" style={{ color:T.muted }}>Confidence</div><div className="font-bold" style={{ color:op.confidence>85?T.green:op.confidence>70?T.amber:T.red }}>{op.confidence}%</div></div>
                        <div className="flex gap-2">{!["Won","Lost"].includes(op.status) && <button onClick={()=>closeWon(op)} title="Mark Won & invoice" className="p-2 rounded-xl" style={{ background:T.green+"15", color:T.green }}><SVG d={IC.check} size={13} /></button>}<button onClick={()=>delOpp(op.id, op.title)} className="p-2 rounded-xl" style={{ background:T.red+"15", color:T.red }}><SVG d={IC.trash} size={13} /></button></div>
                      </div>
                    </div>
                  ))}</div>}
            </div>
          )}

          {/* PIPELINE */}
          {tab==="pipeline" && (
            <div className="flex flex-col gap-5">
              <h1 className="text-2xl font-black text-white">Deal Pipeline</h1>
              {opps.length===0 ? <Empty icon={IC.kanban} title="Pipeline is empty" sub="Opportunities appear here as the AI proposes them." />
                : <div className="flex gap-4 overflow-x-auto pb-4">{["New","Evaluating","Active","Closing"].map(stage => {
                    const cols={ New:T.blue, Evaluating:T.amber, Active:T.green, Closing:T.purple }; const items=opps.filter(o=>o.status===stage);
                    return (
                      <div key={stage} className="flex flex-col gap-3 min-w-56 flex-1">
                        <div className="flex items-center gap-2 px-1"><div className="w-2 h-2 rounded-full" style={{ background:cols[stage] }} /><span className="text-xs font-bold uppercase tracking-widest" style={{ color:T.muted }}>{stage}</span><span className="text-xs ml-auto" style={{ color:T.dim }}>{items.length}</span></div>
                        {items.map(op => (<div key={op.id} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background:T.card, border:`1px solid ${T.border}` }}><div className="text-xs font-bold text-white leading-snug">{op.title}</div>{op.commission>0 && <div className="text-xs font-bold" style={{ color:T.green }}>+{cur} {Number(op.commission).toLocaleString()}</div>}<div className="flex gap-1.5 flex-wrap mt-1"><Pill label={`${op.confidence}%`} color={op.confidence>85?T.green:op.confidence>70?T.amber:T.red} /></div></div>))}
                        {items.length===0 && <div className="rounded-2xl p-4 text-xs text-center" style={{ border:`1px dashed ${T.border}`, color:T.dim }}>Empty</div>}
                      </div>
                    );
                  })}</div>}
            </div>
          )}

          {/* CONTACTS */}
          {tab==="contacts" && (
            <div className="flex flex-col gap-5 max-w-5xl mx-auto">
              <div><h1 className="text-2xl font-black text-white">Contacts</h1><p className="text-sm mt-1" style={{ color:T.muted }}>Buyers and suppliers you've approved from AI leads.</p></div>
              {buyers.length===0 && suppliers.length===0 ? <Empty icon={IC.buyers} title="No contacts yet" sub="Approve AI leads to build your network — you don't add them by hand." action="Review Leads" onAction={()=>setTab("leads")} />
                : <>
                    {buyers.length>0 && <div><div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color:T.muted }}>Buyers</div><div className="grid md:grid-cols-2 gap-4">{buyers.map(b => {
                      const days = daysSinceContact(b);
                      const health = contactHealthBadge(days);
                      return (
                      <div key={b.id} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background:T.card, border:`1px solid ${b.dnc ? T.red+"44" : T.border}` }}>
                        <div className="flex items-start justify-between"><div><div className="text-sm font-bold text-white">{b.name}</div><div className="text-xs mt-0.5" style={{ color:T.muted }}>{b.country} · {b.industry}</div></div><StatusPill status={b.status} /></div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:health.color }} /><span className="text-xs" style={{ color:health.color }}>{health.label}</span>
                          {b.dnc && <Pill label="🚫 Do Not Contact" color={T.red} />}
                        </div>
                        {b.email && <div className="text-xs flex items-center gap-1.5" style={{ color:T.dim }}><SVG d={IC.mail} size={11} />{b.email}</div>}
                        {b.phone && <div className="text-xs flex items-center gap-1.5" style={{ color:T.dim }}><SVG d={IC.msg} size={11} />{b.phone}</div>}
                        {b.notes && <p className="text-xs leading-relaxed" style={{ color:T.muted }}>{b.notes}</p>}
                        <div className="flex gap-2">
                          <button onClick={()=>draftCheckIn(b,"buyer")} disabled={!!b.dnc} className="flex-1 text-xs py-1.5 rounded-lg font-medium disabled:opacity-40" style={{ background:T.blue+"18", color:T.blue, border:`1px solid ${T.blue}33` }}>💬 Send Check-in</button>
                          <button onClick={()=>toggleDnc(b,"buyer")} className="p-1.5 rounded-lg" title={b.dnc ? "Re-enable contact" : "Mark Do Not Contact"} style={{ background:(b.dnc?T.green:T.red)+"15", color:b.dnc?T.green:T.red }}><SVG d={b.dnc ? IC.check : IC.lock} size={12} /></button>
                          <button onClick={()=>delBuyer(b.id, b.name)} className="p-1.5 rounded-lg" style={{ background:T.red+"15", color:T.red }}><SVG d={IC.trash} size={12} /></button>
                        </div>
                      </div>
                      );
                    })}</div></div>}
                    {suppliers.length>0 && <div><div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color:T.muted }}>Suppliers</div><div className="grid md:grid-cols-2 gap-4">{suppliers.map(s => {
                      const days = daysSinceContact(s);
                      const health = contactHealthBadge(days);
                      return (
                      <div key={s.id} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background:T.card, border:`1px solid ${s.dnc ? T.red+"44" : T.border}` }}>
                        <div className="flex items-start justify-between"><div><div className="text-sm font-bold text-white">{s.name}</div><div className="text-xs mt-0.5" style={{ color:T.muted }}>{s.country} · {s.product}</div></div><Pill label={s.certified?"Certified":"Unverified"} color={s.certified?T.green:T.amber} /></div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background:health.color }} /><span className="text-xs" style={{ color:health.color }}>{health.label}</span>
                          {s.dnc && <Pill label="🚫 Do Not Contact" color={T.red} />}
                        </div>
                        {s.email && <div className="text-xs flex items-center gap-1.5" style={{ color:T.dim }}><SVG d={IC.mail} size={11} />{s.email}</div>}
                        {s.phone && <div className="text-xs flex items-center gap-1.5" style={{ color:T.dim }}><SVG d={IC.msg} size={11} />{s.phone}</div>}
                        {s.notes && <p className="text-xs leading-relaxed" style={{ color:T.muted }}>{s.notes}</p>}
                        <div className="flex gap-2">
                          <button onClick={()=>draftCheckIn(s,"supplier")} disabled={!!s.dnc} className="flex-1 text-xs py-1.5 rounded-lg font-medium disabled:opacity-40" style={{ background:T.blue+"18", color:T.blue, border:`1px solid ${T.blue}33` }}>💬 Send Check-in</button>
                          <button onClick={()=>toggleDnc(s,"supplier")} className="p-1.5 rounded-lg" title={s.dnc ? "Re-enable contact" : "Mark Do Not Contact"} style={{ background:(s.dnc?T.green:T.red)+"15", color:s.dnc?T.green:T.red }}><SVG d={s.dnc ? IC.check : IC.lock} size={12} /></button>
                          <button onClick={()=>delSupplier(s.id, s.name)} className="p-1.5 rounded-lg" style={{ background:T.red+"15", color:T.red }}><SVG d={IC.trash} size={12} /></button>
                        </div>
                      </div>
                      );
                    })}</div></div>}
                  </>}
            </div>
          )}

          {/* SENT */}
          {tab==="sent" && (
            <div className="flex flex-col gap-5 max-w-3xl mx-auto">
              <div><h1 className="text-2xl font-black text-white">Sent Log</h1><p className="text-sm mt-1" style={{ color:T.muted }}>Every message you approved and sent.</p></div>
              {sent.length===0 ? <Empty icon={IC.mail} title="Nothing sent yet" sub="Approved messages appear here." />
                : <div className="flex flex-col gap-3">{sent.map(m => (
                    <div key={m.id} className="rounded-2xl p-4 flex flex-col gap-2" style={{ background:T.card, border:`1px solid ${T.border}` }}>
                      <div className="flex items-center gap-2 flex-wrap"><Pill label={m.channel==="email"?"Email":"SMS"} color={m.channel==="email"?T.blue:T.green} /><Pill label={m.delivery==="sent"?"Delivered":m.delivery==="handoff"?"Opened in app":"Queued"} color={m.delivery==="sent"?T.green:T.amber} /><span className="text-xs" style={{ color:T.muted }}>{m.recipient_name}</span><span className="text-xs ml-auto" style={{ color:T.dim }}>{new Date(m.sent_at).toLocaleString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span></div>
                      {m.channel==="email" && m.subject && <div className="text-sm font-bold text-white">{m.subject}</div>}
                      <div className="text-sm leading-relaxed" style={{ color:T.muted, whiteSpace:"pre-wrap" }}>{m.body}</div>
                    </div>
                  ))}</div>}
            </div>
          )}

          {/* DOCUMENTS */}
          {tab==="documents" && (
            <div className="flex flex-col gap-6 max-w-5xl mx-auto">
              <div><h1 className="text-2xl font-black text-white">Legal & Invoices</h1><p className="text-sm mt-1" style={{ color:T.muted }}>Invoices and contracts in seconds, pre-filled with your business and banking details.</p></div>
              <div className="p-4 rounded-2xl flex items-start gap-3" style={{ background:T.amber+"0d", border:`1px solid ${T.amber}30` }}><SVG d={IC.scale} size={14} style={{ color:T.amber, flexShrink:0, marginTop:2 }} /><div className="text-xs leading-relaxed" style={{ color:T.muted }}><span className="font-semibold" style={{ color:T.amber }}>Templates, not legal advice. </span>AI-drafted under South African law. Have an SA attorney review before signing. Fill in your details under Settings first.</div></div>
              <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background:T.card, border:`1px solid ${T.pink}30` }}>
                <div className="flex items-center gap-2"><SVG d={IC.file} size={15} style={{ color:T.pink }} /><span className="text-sm font-bold text-white">Commission Invoice</span></div>
                <p className="text-xs" style={{ color:T.muted }}>Generate from any deal. Marking a deal Won creates one automatically.</p>
                {opps.length===0 ? <div className="text-xs py-2" style={{ color:T.dim }}>No deals yet.</div>
                  : <div className="flex flex-col gap-2">{opps.map(op => (
                      <div key={op.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background:T.surface, border:`1px solid ${T.border}` }}>
                        <div className="flex-1 min-w-0"><div className="text-xs font-semibold text-white truncate">{op.title}</div><div className="text-xs" style={{ color:T.muted }}>{op.commission?`${cur} ${Number(op.commission).toLocaleString()} commission`:"No commission set"} · {op.status}</div></div>
                        <Btn onClick={()=>generateInvoice(op, buyers[0]||null)} color={T.pink} sm><SVG d={IC.file} size={12} />Invoice</Btn>
                      </div>
                    ))}</div>}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3"><SVG d={IC.scale} size={14} style={{ color:T.cyan }} /><h2 className="text-sm font-bold text-white">Generate a Legal Document</h2></div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{DOC_TYPES.map(dt => (
                  <div key={dt.key} className="rounded-2xl p-4 flex flex-col gap-3" style={{ background:T.card, border:`1px solid ${T.border}` }}>
                    <div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:dt.color+"18" }}><SVG d={IC.file} size={15} style={{ color:dt.color }} /></div><div className="text-sm font-bold text-white leading-tight">{dt.label}</div></div>
                    <p className="text-xs leading-relaxed flex-1" style={{ color:T.muted }}>{dt.desc}</p>
                    <Btn onClick={()=>setDocGenType(dt)} disabled={busy===("doc:"+dt.key)} color={dt.color} sm full>{busy===("doc:"+dt.key)?"Drafting…":<><SVG d={IC.plus} size={12} />Draft</>}</Btn>
                  </div>
                ))}</div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3"><SVG d={IC.copy} size={14} style={{ color:T.purple }} /><h2 className="text-sm font-bold text-white">Document Library</h2><span className="text-xs" style={{ color:T.dim }}>{docs.length} saved</span></div>
                {docs.length===0 ? <Empty icon={IC.scale} title="No documents yet" sub="Generate an invoice or contract above." />
                  : <div className="flex flex-col gap-2">{docs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background:T.card, border:`1px solid ${T.border}` }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:(doc.type==="Invoice"?T.pink:T.cyan)+"18" }}><SVG d={doc.type==="Invoice"?IC.file:IC.scale} size={15} style={{ color:doc.type==="Invoice"?T.pink:T.cyan }} /></div>
                        <div className="flex-1 min-w-0"><div className="text-sm font-semibold text-white truncate">{doc.title||doc.type}</div><div className="text-xs" style={{ color:T.muted }}>{doc.invoice_no?`${doc.invoice_no} · `:""}{doc.type}{doc.amount?` · ${cur} ${Number(doc.amount).toLocaleString()}`:""} · {new Date(doc.created_at).toLocaleDateString("en-ZA")}</div></div>
                        <div className="flex gap-1.5 flex-shrink-0"><button onClick={()=>setViewDoc(doc)} className="p-2 rounded-xl" style={{ background:T.surface, color:T.text }}><SVG d={IC.doc} size={13} /></button><button onClick={()=>copyDoc(doc)} className="p-2 rounded-xl" style={{ background:T.surface, color:T.muted }}><SVG d={IC.copy} size={13} /></button><button onClick={()=>downloadDoc(doc)} className="p-2 rounded-xl" style={{ background:T.surface, color:T.muted }}><SVG d={IC.download} size={13} /></button><button onClick={()=>delDoc(doc.id, doc.title||doc.type)} className="p-2 rounded-xl" style={{ background:T.red+"15", color:T.red }}><SVG d={IC.trash} size={13} /></button></div>
                      </div>
                    ))}</div>}
              </div>
            </div>
          )}

          {/* EARNINGS */}
          {tab==="revenue" && (
            <div className="flex flex-col gap-5 max-w-5xl mx-auto">
              <h1 className="text-2xl font-black text-white">Earnings</h1>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Metric label="Booked Earnings" value={bookedEarnings?`${cur} ${(bookedEarnings/1000).toFixed(1)}K`:`${cur} 0`} sub="Commission won" accent={T.green} icon={IC.wallet} />
                <Metric label="Pipeline" value={totalPipeline?`${cur} ${(totalPipeline/1000).toFixed(1)}K`:`${cur} 0`} sub="Potential" accent={T.amber} icon={IC.rev} />
                <Metric label="Deals Won" value={earnings.length} sub="Closed" accent={T.purple} icon={IC.check} />
                <Metric label="Opportunities" value={opps.length} sub="Tracked" accent={T.blue} icon={IC.opp} />
              </div>
              {earnings.length>0 && <div><h2 className="text-sm font-bold text-white mb-3">Commission Ledger</h2><div className="flex flex-col gap-2">{earnings.map(e => (
                <div key={e.id} className="flex items-center gap-4 rounded-2xl px-4 py-3" style={{ background:T.card, border:`1px solid ${T.green}22` }}><SVG d={IC.wallet} size={15} style={{ color:T.green, flexShrink:0 }} /><div className="flex-1 text-sm text-white truncate">{e.title}</div><div className="text-xs" style={{ color:T.dim }}>{new Date(e.date).toLocaleDateString("en-ZA")}</div><div className="text-sm font-bold w-28 text-right" style={{ color:T.green }}>+{cur} {Number(e.amount).toLocaleString()}</div></div>
              ))}</div></div>}
              {earnings.length===0 && opps.length===0 && <Empty icon={IC.wallet} title="No earnings yet" sub="Close deals to book commission." />}
            </div>
          )}

          {/* AGENTS */}
          {tab==="agents" && (
            <div className="flex flex-col gap-5 max-w-5xl mx-auto">
              <div><h1 className="text-2xl font-black text-white">AI Agent Team</h1><p className="text-sm mt-1" style={{ color:T.muted }}>Written communication only. Your approval before every send.</p></div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{AGENTS.map(agent => (
                <div key={agent.id} className="rounded-2xl p-4 flex flex-col gap-3" style={{ background:T.card, border:`1px solid ${T.border}` }}>
                  <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:agent.color+"20" }}><SVG d={agent.icon} size={16} style={{ color:agent.color }} /></div><div><div className="text-sm font-bold text-white">{agent.name}</div><div className="flex items-center gap-1 mt-0.5"><div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:agent.color }} /><span className="text-xs" style={{ color:agent.color }}>Live</span></div></div></div>
                  <p className="text-xs leading-relaxed flex-1" style={{ color:T.muted }}>{agent.desc}</p>
                  <button onClick={()=>setChatAgent(agent)} className="text-xs py-2 px-3 rounded-xl text-left" style={{ background:agent.color+"15", color:agent.color, border:`1px solid ${agent.color}30` }}>Brief this agent →</button>
                </div>
              ))}</div>
            </div>
          )}

          {/* SETTINGS */}
          {tab==="settings" && <SettingsTab p={p} setP={setP} saveProfile={saveProfile} emailReady={emailReady} smsReady={smsReady} />}

          <Footer onOpenLegal={setLegalDoc} />
        </div>
      </div>

      {/* MODALS */}
      {legalDoc && (
        <Modal title={legalDoc==="terms"?"Terms and Conditions":legalDoc==="privacy"?"Privacy Policy":"Disclaimer"} onClose={()=>setLegalDoc(null)}>
          <pre className="text-xs leading-relaxed whitespace-pre-wrap" style={{ color:T.muted, fontFamily:"inherit" }}>{LEGAL_TEXT[legalDoc]}</pre>
        </Modal>
      )}
      {chatAgent && <AgentChat agent={chatAgent} ctx={{ focus:p.focus, buyers:buyers.length, suppliers:suppliers.length, opps:opps.length, totalPipeline, bookedEarnings }} onClose={()=>setChatAgent(null)} />}
      {viewDoc && (
        <Modal title={viewDoc.title||viewDoc.type} onClose={()=>setViewDoc(null)} wide>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl p-4 text-xs leading-relaxed" style={{ background:T.surface, border:`1px solid ${T.border}`, color:T.text, whiteSpace:"pre-wrap", fontFamily:"ui-monospace, monospace", maxHeight:"50vh", overflowY:"auto" }}>{viewDoc.content}</div>
            <div className="flex gap-2"><Btn onClick={()=>copyDoc(viewDoc)} color={T.cyan} sm><SVG d={IC.copy} size={13} />Copy</Btn><Btn onClick={()=>downloadDoc(viewDoc)} color={T.green} sm><SVG d={IC.download} size={13} />Download</Btn></div>
          </div>
        </Modal>
      )}
      {docGenType && <DocGenModal docType={docGenType} buyers={buyers} suppliers={suppliers} opps={opps} busy={busy===("doc:"+docGenType.key)} onGenerate={(name,opp)=>{ generateLegalDoc(docGenType,name,opp); setDocGenType(null); }} onClose={()=>setDocGenType(null)} />}
    </div>
    </ErrorBoundary>
  );
}

// ── SUBCOMPONENTS ──
function Metric({ label, value, sub, accent, icon }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background:T.card, border:`1px solid ${accent}22` }}>
      <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-widest" style={{ color:T.muted }}>{label}</span><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:accent+"18" }}><SVG d={icon} size={14} style={{ color:accent }} /></div></div>
      <div className="text-2xl font-black" style={{ color:accent }}>{value}</div>
      {sub && <div className="text-xs" style={{ color:T.muted }}>{sub}</div>}
    </div>
  );
}
function StatusPill({ status }) {
  const m={ New:T.blue, Evaluating:T.amber, Active:T.green, Closing:T.purple, Won:T.green, Lost:T.red };
  return <Pill label={status} color={m[status]||T.muted} />;
}
function Empty({ icon, title, sub, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background:T.card, border:`1px solid ${T.border}` }}><SVG d={icon} size={24} style={{ color:T.muted }} /></div>
      <div><div className="text-base font-semibold text-white mb-1">{title}</div><div className="text-sm max-w-xs mx-auto" style={{ color:T.muted }}>{sub}</div></div>
      {action && <Btn onClick={onAction}><SVG d={IC.bolt} size={13} />{action}</Btn>}
    </div>
  );
}
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:"#00000088" }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className={`w-full ${wide?"max-w-2xl":"max-w-md"} rounded-2xl flex flex-col max-h-[90vh]`} style={{ background:T.card, border:`1px solid ${T.border2}` }}>
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor:T.border }}><h3 className="font-bold text-white text-sm">{title}</h3><button onClick={onClose} className="text-slate-600 hover:text-white"><SVG d={IC.x} size={16} /></button></div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}
function DocGenModal({ docType, buyers, suppliers, opps, busy, onGenerate, onClose }) {
  const [name, setName] = useState(""); const [oppTitle, setOppTitle] = useState("");
  const contacts = [...buyers.map(b=>({...b,_t:"Buyer"})), ...suppliers.map(s=>({...s,_t:"Supplier"}))];
  return (
    <Modal title={`Draft — ${docType.label}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-xs leading-relaxed" style={{ color:T.muted }}>{docType.desc} The AI uses your saved business and banking details for the rest.</p>
        <Field label="Counterparty Name (optional)"><Input value={name} onChange={setName} placeholder="Company or person" /></Field>
        {contacts.length>0 && <div className="flex flex-wrap gap-2">{contacts.slice(0,8).map(c => (<button key={c.id} onClick={()=>setName(c.name)} className="text-xs px-2.5 py-1 rounded-full" style={{ background:T.surface, color:T.muted, border:`1px solid ${T.border}` }}>{c.name} <span style={{ color:T.dim }}>· {c._t}</span></button>))}</div>}
        <Field label="Related Deal (optional)"><Select value={oppTitle} onChange={setOppTitle}><option value="">— none —</option>{opps.map(o => <option key={o.id} value={o.title}>{o.title}</option>)}</Select></Field>
        <Btn onClick={()=>onGenerate(name, oppTitle)} disabled={busy} color={docType.color} full>{busy?"AI drafting…":<><SVG d={IC.sparkle} size={14} />Generate with AI</>}</Btn>
      </div>
    </Modal>
  );
}

function AgentChat({ agent, ctx, onClose }) {
  const [msgs, setMsgs] = useState([]); const [input, setInput] = useState(""); const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  useEffect(()=>{ endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);
  const system = `You are ${agent.name} on an autonomous trade-broker team. ${agent.desc} Context: ${JSON.stringify(ctx)}. Written communication only. No profit guarantees. Approval required before sends. Be concise.`;
  const send = async () => {
    if (!input.trim()||loading) return;
    const um = { role:"user", content:input.trim() }; setMsgs(p=>[...p,um]); setInput(""); setLoading(true);
    try { const data = await callClaude([...msgs,um].map(m=>({role:m.role,content:m.content})), system); setMsgs(p=>[...p,{role:"assistant",content:data.text}]); }
    catch { setMsgs(p=>[...p,{role:"assistant",content:"⚠️ Connection error."}]); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-end p-0 md:p-6" style={{ background:"#00000066" }} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="w-full md:w-[420px] h-[85vh] md:h-[600px] rounded-t-3xl md:rounded-2xl flex flex-col overflow-hidden" style={{ background:T.card, border:`1px solid ${agent.color}33` }}>
        <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0" style={{ borderColor:T.border, background:agent.color+"0d" }}><div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background:agent.color+"22" }}><SVG d={agent.icon} size={15} style={{ color:agent.color }} /></div><div className="flex-1"><div className="text-sm font-bold text-white">{agent.name}</div><div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:agent.color }} /><span className="text-xs" style={{ color:T.muted }}>Live</span></div></div><button onClick={onClose} className="text-slate-600 hover:text-white"><SVG d={IC.x} size={16} /></button></div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {msgs.length===0 && <div className="text-center py-8"><div className="text-xs mb-3" style={{ color:T.muted }}>{agent.desc}</div></div>}
          {msgs.map((m,i) => (<div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}><div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role==="user"?"rounded-br-sm":"rounded-bl-sm"}`} style={m.role==="user"?{ background:agent.color+"25", color:T.text }:{ background:T.surface, color:T.text, border:`1px solid ${T.border}` }}><div style={{ whiteSpace:"pre-wrap" }}>{m.content}</div></div></div>))}
          {loading && <div className="flex justify-start"><div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ background:T.surface, border:`1px solid ${T.border}` }}><div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background:agent.color, animationDelay:`${i*150}ms` }} />)}</div></div></div>}
          <div ref={endRef} />
        </div>
        <div className="flex gap-2 p-3 border-t flex-shrink-0" style={{ borderColor:T.border }}><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={`Brief ${agent.name}…`} className="flex-1 text-sm rounded-xl px-3 py-2.5 outline-none placeholder-slate-600" style={{ background:T.surface, border:`1px solid ${T.border}`, color:T.text }} /><button onClick={send} disabled={loading||!input.trim()} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40" style={{ background:agent.color+"25", color:agent.color }}><SVG d={IC.send} size={16} /></button></div>
      </div>
    </div>
  );
}

function SettingsTab({ p, setP, saveProfile, emailReady, smsReady }) {
  const set = (k) => (v) => setP(prev => ({ ...prev, [k]: v }));
  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-black text-white">Settings</h1>

      <div className="flex flex-col gap-4">
        <div className="text-xs font-bold uppercase tracking-widest" style={{ color:T.amber }}>Operation Profile</div>
        <Field label="Your Name"><Input value={p.owner_name||""} onChange={set("owner_name")} placeholder="Commander" /></Field>
        <Field label="AI Focus" hint="What the Lead Finder hunts for."><Input value={p.focus||""} onChange={set("focus")} placeholder="Broad bulk trade…" multiline rows={2} /></Field>
        <Field label="Primary Market / Regions"><Input value={p.market||""} onChange={set("market")} placeholder="Africa, GCC, EU" /></Field>
        <Field label="Commission Target"><Input value={p.target||""} onChange={set("target")} placeholder="$50,000 / month" /></Field>
        <Field label="Message Sign-off"><Input value={p.signoff||""} onChange={set("signoff")} placeholder="Trade Operations" /></Field>
        <Btn onClick={()=>saveProfile({ owner_name:p.owner_name, focus:p.focus, market:p.market, target:p.target, signoff:p.signoff })} full color={T.amber}>Save Profile</Btn>
      </div>

      <div className="flex flex-col gap-4 pt-2">
        <div className="flex items-center gap-2"><SVG d={IC.bank} size={14} style={{ color:T.pink }} /><div className="text-xs font-bold uppercase tracking-widest" style={{ color:T.pink }}>Business & Banking</div></div>
        <p className="text-xs leading-relaxed" style={{ color:T.muted }}>Auto-fills every invoice and contract. For SA brokers, a CFC account (Standard Bank/FNB) receives foreign commission without forced rand conversion.</p>
        <Field label="Registered Business Name"><Input value={p.legal_name||""} onChange={set("legal_name")} placeholder="Your Trading (Pty) Ltd" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Company Reg No"><Input value={p.reg_no||""} onChange={set("reg_no")} placeholder="2024/123456/07" /></Field><Field label="VAT No"><Input value={p.vat_no||""} onChange={set("vat_no")} placeholder="4xxxxxxxxx" /></Field></div>
        <Field label="Address"><Input value={p.address||""} onChange={set("address")} placeholder="Street, suburb" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="City"><Input value={p.city||""} onChange={set("city")} placeholder="Johannesburg" /></Field><Field label="Province"><Input value={p.province||""} onChange={set("province")} placeholder="Gauteng" /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Business Email"><Input value={p.biz_email||""} onChange={set("biz_email")} type="email" placeholder="accounts@yourco.com" /></Field><Field label="Business Phone"><Input value={p.biz_phone||""} onChange={set("biz_phone")} placeholder="+27…" /></Field></div>
        <Field label="Default Commission Rate (%)"><Input value={p.commission_rate||""} onChange={set("commission_rate")} type="number" placeholder="5" /></Field>
        <div className="text-xs font-bold pt-1" style={{ color:T.text }}>Bank Details (international wires)</div>
        <Field label="Bank Name"><Input value={p.bank_name||""} onChange={set("bank_name")} placeholder="Standard Bank / FNB / Nedbank" /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Account Name"><Input value={p.account_name||""} onChange={set("account_name")} placeholder="Account holder" /></Field><Field label="Account Number"><Input value={p.account_no||""} onChange={set("account_no")} placeholder="CFC / business acct" /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Branch"><Input value={p.bank_branch||""} onChange={set("bank_branch")} placeholder="Sandton" /></Field><Field label="Branch Code"><Input value={p.branch_code||""} onChange={set("branch_code")} placeholder="051001" /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="SWIFT / BIC" hint="SBZAZAJJ (Std Bank), FIRNZAJJ (FNB)"><Input value={p.swift||""} onChange={set("swift")} placeholder="SBZAZAJJ" /></Field><Field label="Default Currency"><Select value={p.currency||"USD"} onChange={set("currency")}>{["USD","EUR","GBP","ZAR","AED","CNY"].map(c=><option key={c}>{c}</option>)}</Select></Field></div>
        <Field label="IBAN (optional)"><Input value={p.iban||""} onChange={set("iban")} placeholder="Leave blank if not issued" /></Field>
        <Btn onClick={()=>saveProfile({ legal_name:p.legal_name, reg_no:p.reg_no, vat_no:p.vat_no, address:p.address, city:p.city, province:p.province, biz_email:p.biz_email, biz_phone:p.biz_phone, commission_rate:p.commission_rate, bank_name:p.bank_name, account_name:p.account_name, account_no:p.account_no, bank_branch:p.bank_branch, branch_code:p.branch_code, swift:p.swift, currency:p.currency, iban:p.iban })} full color={T.pink}>Save Business & Banking</Btn>
      </div>

      <div className="flex flex-col gap-4 pt-2">
        <div className="flex items-center gap-2"><SVG d={IC.key} size={14} style={{ color:T.cyan }} /><div className="text-xs font-bold uppercase tracking-widest" style={{ color:T.cyan }}>Integrations — Sending</div></div>
        <p className="text-xs leading-relaxed" style={{ color:T.muted }}>Your own keys so approved messages send automatically. Without them, approving opens your device's app. Stored privately on your account.</p>
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background:T.card, border:`1px solid ${smsReady?T.green:T.border}` }}>
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><SVG d={IC.msg} size={14} style={{ color:T.green }} /><span className="text-sm font-bold text-white">SMS — Twilio</span></div><Pill label={smsReady?"Connected":"Not set"} color={smsReady?T.green:T.dim} /></div>
          <Field label="Account SID" hint="Twilio Console (AC…)."><Input value={p.twilio_sid||""} onChange={set("twilio_sid")} placeholder="ACxxxxxxxx" /></Field>
          <Field label="Auth Token"><Input value={p.twilio_token||""} onChange={set("twilio_token")} type="password" placeholder="••••••••" /></Field>
          <Field label="From Number" hint="E.164, e.g. +14155551234"><Input value={p.twilio_from||""} onChange={set("twilio_from")} placeholder="+14155551234" /></Field>
        </div>
        <Btn onClick={()=>saveProfile({ resend_key:p.resend_key, from_email:p.from_email, twilio_sid:p.twilio_sid, twilio_token:p.twilio_token, twilio_from:p.twilio_from })} full color={T.cyan}>Save Integrations</Btn>
        <div className="text-xs leading-relaxed p-3 rounded-xl" style={{ background:T.amber+"0d", color:T.muted, border:`1px solid ${T.amber}22` }}><span className="font-semibold" style={{ color:T.amber }}>Note: </span>Some providers block direct browser calls (CORS). If a send fails, route it through a small serverless relay (Cloudflare Worker / Vercel function).</div>
      </div>

      <div className="p-4 rounded-2xl" style={{ background:T.card, border:`1px solid ${T.red}30` }}>
        <div className="font-bold text-xs mb-3" style={{ color:T.red }}>System Constraints — Non-Negotiable</div>
        {["Written messages only — no calls or video","No meetings arranged","No profit guarantees","No contracts executed by the AI","AI never impersonates a human","Every message and lead requires your approval","AI-proposed leads are candidates, not confirmed buyers"].map((c,i)=>(<div key={i} className="flex items-start gap-2 text-xs mb-1.5" style={{ color:T.muted }}><SVG d={IC.lock} size={11} style={{ color:T.red, flexShrink:0, marginTop:1 }} />{c}</div>))}
      </div>
    </div>
  );
}