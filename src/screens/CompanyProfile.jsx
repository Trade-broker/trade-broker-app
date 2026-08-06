import { T, SVG, IC, Logo } from "../lib/ui.jsx";

// ── PUBLIC COMPANY PROFILE / VERIFICATION PAGE ──
// No login required. Link this directly from email signatures, WhatsApp,
// or anywhere else so buyers/suppliers can verify who they're dealing with
// before responding to outreach.
//
// Deliberately excluded: director's ID number. Full name + SA ID number is
// exactly what identity fraud is built from — including it here would work
// against the "prove I'm legitimate" goal, not for it. Registration number
// and registered address are public record via CIPC already, so those are
// safe and sufficient for independent verification.

const COMPANY = {
  name: "BLACK GOLD NEXUS (PTY) LTD",
  reg: "2026/565924/07",
  director: "Philip Koekemoer",
  incorporated: "17 July 2026",
  status: "IN BUSINESS",
  type: "Private Company",
  address: "31 Olienhout Street, Chantel, Akasia, Pretoria, Gauteng, 0001, South Africa",
  yearEnd: "November",
  email: "blackgoldnexus@gmail.com",
};

function Section({ title, icon, children }) {
  return (
    <div className="rounded-2xl p-5 md:p-6 flex flex-col gap-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: T.amber + "18" }}>
          <SVG d={icon} size={15} style={{ color: T.amber }} />
        </div>
        <h2 className="text-sm font-bold text-white">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed" style={{ color: T.muted }}>{children}</div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b" style={{ borderColor: T.border }}>
      <span className="text-xs uppercase tracking-widest flex-shrink-0" style={{ color: T.dim }}>{label}</span>
      <span className="text-sm font-semibold text-white text-right">{value}</span>
    </div>
  );
}

export default function CompanyProfile() {
  return (
    <div className="min-h-screen" style={{ background: T.bg, fontFamily: "'Inter', system-ui, sans-serif", color: T.text }}>
      <div className="max-w-2xl mx-auto px-5 py-10 md:py-16 flex flex-col gap-6">

        {/* HERO */}
        <div className="flex flex-col items-center text-center gap-4 mb-4">
          <Logo size={56} />
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">{COMPANY.name}</h1>
            <p className="text-sm mt-1" style={{ color: T.amber }}>Registered Trade Brokerage · South Africa</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: T.green + "15", border: `1px solid ${T.green}33` }}>
            <div className="w-2 h-2 rounded-full" style={{ background: T.green }} />
            <span className="text-xs font-semibold" style={{ color: T.green }}>CIPC Registered — {COMPANY.status}</span>
          </div>
        </div>

        {/* WHO WE ARE */}
        <Section title="Who We Are" icon={IC.buyers}>
          {COMPANY.name} is a registered South African trade brokerage, incorporated with the Companies and
          Intellectual Property Commission (CIPC) on {COMPANY.incorporated}. We operate as an intermediary,
          connecting buyers and suppliers and facilitating written negotiations between them — we do not take
          title to goods ourselves.
        </Section>

        {/* WHAT WE DO */}
        <Section title="What We Do" icon={IC.opp}>
          We source and vet buyer and supplier candidates, facilitate introductions, and support deals through
          to completion — commission agreements, invoicing, and standard trade documentation. Our current focus
          spans solar equipment, building materials, and other high-demand goods; we work across categories as
          opportunities arise. Every engagement starts in writing and every commitment is documented.
        </Section>

        {/* REGISTRATION DETAILS */}
        <Section title="Company Registration" icon={IC.scale}>
          <div className="flex flex-col mt-1">
            <Row label="Registration No." value={COMPANY.reg} />
            <Row label="Entity Type" value={COMPANY.type} />
            <Row label="Status" value={COMPANY.status} />
            <Row label="Director" value={COMPANY.director} />
            <Row label="Incorporated" value={COMPANY.incorporated} />
            <Row label="Registered Address" value={COMPANY.address} />
          </div>
          <p className="text-xs mt-3 leading-relaxed" style={{ color: T.dim }}>
            You can independently verify this registration at any time via CIPC's public company search at{" "}
            <span style={{ color: T.amber }}>www.cipc.co.za</span> using registration number {COMPANY.reg}.
          </p>
        </Section>

        {/* HOW WE OPERATE */}
        <Section title="How We Operate" icon={IC.lock}>
          <div className="flex flex-col gap-2">
            {[
              "All negotiation is conducted in writing — no calls, no video, nothing verbal-only",
              "No profit guarantees are ever made, to any party, at any stage",
              "Every commercial document (NDA, commission agreement, sales contract) is issued in writing before funds or goods move",
              "We do not request upfront fees to \"unlock\" a deal — standard advance-fee fraud red flag",
            ].map((line, i) => (
              <div key={i} className="flex items-start gap-2">
                <SVG d={IC.check} size={13} style={{ color: T.green, flexShrink: 0, marginTop: 2 }} />
                <span className="text-sm" style={{ color: T.muted }}>{line}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* CONTACT */}
        <Section title="Contact" icon={IC.mail}>
          <div className="flex items-center gap-2">
            <SVG d={IC.mail} size={14} style={{ color: T.dim }} />
            <a href={`mailto:${COMPANY.email}`} className="text-sm font-semibold" style={{ color: T.amber }}>{COMPANY.email}</a>
          </div>
        </Section>

        {/* FOOTER NOTE */}
        <p className="text-xs text-center leading-relaxed mt-2" style={{ color: T.dim }}>
          This page is provided for verification purposes only and does not constitute a binding offer.
          Always independently verify any counterparty before entering into a transaction.
        </p>
      </div>
    </div>
  );
}
