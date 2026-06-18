export const PHASES = [
  {
    n: 1,
    title: "Set up your legal entity",
    color: "#f59e0b",
    intro: "Register your company so everything else (bank account, contracts, invoices) can stand on it.",
    tasks: [
      { key: "p1_cipc_register", label: "Register your company on bizportal.gov.za (choose 'commission agent / trade broker' as main activity)", link: "https://www.bizportal.gov.za", upload: false },
      { key: "p1_cipc_doc", label: "Upload your CIPC registration certificate (CoR 14.3 / registration document)", upload: true },
      { key: "p1_tax_number", label: "Note your company income tax number (auto-registered via BizPortal)", upload: false },
      { key: "p1_vat_decision", label: "Decide on VAT (mandatory only above R1m turnover/12 months — tick once decided)", upload: false },
    ],
  },
  {
    n: 2,
    title: "Banking",
    color: "#10b981",
    intro: "Open the accounts that receive your commission. A CFC account lets foreign commission land in USD/EUR/GBP without forced rand conversion.",
    tasks: [
      { key: "p2_biz_account", label: "Open a business bank account (bring CIPC docs + FICA: ID, proof of address)", upload: false },
      { key: "p2_cfc_account", label: "Open a CFC (Customer Foreign Currency) account — Standard Bank or FNB recommended", upload: false },
      { key: "p2_bank_confirm", label: "Upload your bank confirmation letter / account details", upload: true },
      { key: "p2_swift_saved", label: "Enter your SWIFT/BIC, account no, branch code in Settings → Business & Banking", upload: false },
    ],
  },
  {
    n: 3,
    title: "Compliance basics",
    color: "#3b82f6",
    intro: "Keep clean records from day one. Your bank reports cross-border receipts to SARB automatically; you handle the books and tax.",
    tasks: [
      { key: "p3_records", label: "Set up a system to keep records of every deal, invoice and payment", upload: false },
      { key: "p3_accountant", label: "Line up a bookkeeper or accountant (even part-time)", upload: false },
      { key: "p3_tax_setaside", label: "Commit to setting aside a % of every commission for tax", upload: false },
    ],
  },
  {
    n: 4,
    title: "Get your documents legally sound",
    color: "#8b5cf6",
    intro: "The single most important step before real money moves. A weak commission agreement is how brokers lose their fee.",
    tasks: [
      { key: "p4_generate", label: "Generate your core templates in the app (NDA, Commission Agreement, Payment Agreement)", upload: false },
      { key: "p4_attorney", label: "Have a South African attorney review them (one-time, then reuse forever)", upload: false },
      { key: "p4_signed_upload", label: "Upload your attorney-reviewed commission agreement template", upload: true },
    ],
  },
  {
    n: 5,
    title: "Connect sending (optional)",
    color: "#f97316",
    intro: "Let approved messages send automatically. You can skip this and add it later — approving still works by opening your own mail/SMS app.",
    tasks: [
      { key: "p5_resend", label: "Sign up for Resend (email), verify your domain, get API key — or tick to skip", link: "https://resend.com", upload: false },
      { key: "p5_twilio", label: "Sign up for Twilio (SMS), get SID/token/number — or tick to skip", link: "https://twilio.com", upload: false },
      { key: "p5_keys_saved", label: "Enter your sending keys in Settings → Integrations (or tick to skip)", upload: false },
    ],
  },
  {
    n: 6,
    title: "Set your AI focus & launch",
    color: "#06b6d4",
    intro: "Tell the AI what to hunt for. This is what makes the Lead Finder useful instead of random. Broad bulk-trade is the default.",
    tasks: [
      { key: "p6_focus", label: "Set your market focus below (you can choose Broad bulk-trade or a specific niche)", upload: false, focusInput: true },
      { key: "p6_understand", label: "I understand AI-proposed leads are researched candidates, not confirmed buyers — my approval protects me", upload: false },
      { key: "p6_regulated", label: "I understand regulated goods (fuel, diesel, vapes) need real licences (DMRE/SARS) and attorney review", upload: false },
    ],
  },
];

export const FOCUS_PRESETS = [
  "Broad bulk-commodity trade (everything — vapes, fuel, diesel, petroleum, solar, vehicles, any high-volume goods)",
  "Agricultural commodities & food (grains, oils, produce)",
  "Energy & fuel (petroleum, diesel, solar, LPG)",
  "Industrial & raw materials (metals, chemicals, building materials)",
  "Consumer goods in bulk (electronics, FMCG, vapes)",
  "Vehicles & machinery (cars, trucks, equipment)",
];
