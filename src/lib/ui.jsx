// Design tokens + small reusable UI bits shared across screens.

export const T = {
  bg:"#07080f", surface:"#0c0e18", card:"#0f1120", border:"#181d2e", border2:"#222840",
  amber:"#f59e0b", green:"#10b981", blue:"#3b82f6", purple:"#8b5cf6", red:"#ef4444",
  orange:"#f97316", cyan:"#06b6d4", pink:"#ec4899", text:"#e2e8f0", muted:"#64748b", dim:"#334155",
};

export const IC = {
  menu:"M4 6h16M4 12h16M4 18h16", x:"M18 6L6 18M6 6l12 12",
  dash:"M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  opp:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  buyers:"M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  supply:"M4 9h16v11a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 9V7a2 2 0 012-2h12a2 2 0 012 2v2M10 14h4",
  msg:"M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  agent:"M12 2a10 10 0 100 20 10 10 0 000-20zM12 8v4M12 16h.01",
  rev:"M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  tender:"M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
  settings:"M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  search:"M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z", plus:"M12 5v14M5 12h14",
  edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z",
  trash:"M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6", send:"M22 2L11 13M22 2L15 22l-4-9-9-4z",
  bell:"M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  lock:"M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM17 11V7a5 5 0 00-10 0v4",
  star:"M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  trend:"M23 6l-9.5 9.5-5-5L1 18", refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  arrow:"M5 12h14M12 5l7 7-7 7", check:"M20 6L9 17l-5-5",
  ceo:"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM11 17v-6M11 9V7",
  kanban:"M10 3H4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V4a1 1 0 00-1-1zM20 3h-6a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1V4a1 1 0 00-1-1zM20 13h-6a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1v-6a1 1 0 00-1-1zM10 13H4a1 1 0 00-1 1v6a1 1 0 001 1h6a1 1 0 001-1v-6a1 1 0 00-1-1z",
  doc:"M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6", inbox:"M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z",
  bolt:"M13 2L3 14h9l-1 8 10-12h-9l1-8z", mail:"M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zM22 6l-10 7L2 6",
  key:"M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4",
  play:"M5 3l14 9-14 9V3z", pause:"M6 4h4v16H6zM14 4h4v16h-4z",
  wallet:"M21 12V7H5a2 2 0 010-4h14v4M3 5v14a2 2 0 002 2h16v-5M18 12a2 2 0 000 4h4v-4z",
  sparkle:"M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3z",
  scale:"M12 3v18M3 7h18M7 7l-3 7a3 3 0 006 0L7 7zM17 7l-3 7a3 3 0 006 0l-3-7zM5 21h14",
  download:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  copy:"M9 9h11a2 2 0 012 2v9a2 2 0 01-2 2H9a2 2 0 01-2-2v-9a2 2 0 012-2zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
  bank:"M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3",
  file:"M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9zM13 2v7h7",
  upload:"M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12",
  logout:"M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  rocket:"M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09zM12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5",
};

export const SVG = ({ d, size = 16, className = "", style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);

export const Btn = ({ children, onClick, color = T.amber, sm, full, disabled, type = "button" }) => (
  <button type={type} onClick={onClick} disabled={disabled}
    className={`inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all disabled:opacity-40 ${sm ? "text-xs px-3 py-2" : "text-sm px-4 py-2.5"} ${full ? "w-full" : ""}`}
    style={{ background: color + "20", color, border: `1px solid ${color}40` }}>{children}</button>
);

export const Input = ({ value, onChange, placeholder, type = "text", multiline, rows = 3, onKeyDown }) =>
  multiline
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full text-sm rounded-xl px-3 py-2.5 outline-none resize-none placeholder-slate-600"
        style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text }} />
    : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} onKeyDown={onKeyDown}
        className="w-full text-sm rounded-xl px-3 py-2.5 outline-none placeholder-slate-600"
        style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text }} />;

export const Select = ({ value, onChange, children }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    className="w-full text-sm rounded-xl px-3 py-2.5 outline-none"
    style={{ background: T.surface, border: `1px solid ${T.border}`, color: T.text }}>{children}</select>
);

export const Field = ({ label, children, hint }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: T.muted }}>{label}</label>
    {hint && <p className="text-xs leading-relaxed -mt-0.5" style={{ color: T.dim }}>{hint}</p>}
    {children}
  </div>
);

export const Pill = ({ label, color }) => (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
    style={{ background: color + "22", color, border: `1px solid ${color}33` }}>{label}</span>
);

export const Logo = ({ size = 8 }) => (
  <div className={`w-${size} h-${size} rounded-xl flex items-center justify-center flex-shrink-0`}
    style={{ background: "linear-gradient(135deg,#f59e0b,#a855f7)" }}>
    <span className="text-xs font-black text-black">OC</span>
  </div>
);
