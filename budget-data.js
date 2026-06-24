// ── BUDGET TRACKER — line-item structure + seed data ──────────────────────────
// Mirrors the "SaltyORIGINS & Basics Budget 2026" sheet. Each input line has a
// single MONTHLY BUDGETED target plus 12 monthly actuals. Subtotals/Net Profit
// are computed live in the app. The app self-seeds these rows into Supabase the
// first time an editor opens the page on an empty table.

export const BUDGET_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// helper: 12 equal months
const r = v => Array(12).fill(v);
// helper: 11 equal months then a different December
const rDec = (v, dec) => [...Array(11).fill(v), dec];

// kind: group (top section) | sub (sub-header) | input | subtotal | spacer
// sign: +1 income, -1 cost (used for Net Profit + variance favourability)
export const BUDGET_STRUCTURE = [
  { kind: "group", label: "Revenue (Goal)" },
  { kind: "input", key: "total_sales", label: "Total Sales", sign: 1, autoActual: true,
    budget: 450000, actuals: [150000,300000,500000,500000,500000,500000,500000,500000,500000,500000,500000,510000] },

  { kind: "group", label: "COGS" },
  { kind: "input", key: "total_cogs", label: "Total COGS (incl. Design Commission 30%)", sign: -1,
    budget: 0, actuals: [96000, ...Array(11).fill(310000)] },

  { kind: "group", label: "Salaries" },
  { kind: "input", key: "payroll_my",  label: "Payroll (Malaysia)",  sign: -1, budget: 45000, actuals: r(45000) },
  { kind: "input", key: "payroll_sg",  label: "Payroll (SG) @3.3",   sign: -1, budget: 16335, actuals: r(16335) },
  { kind: "input", key: "epf_cpf",     label: "EPF/CPF (yer)",       sign: -1, budget: 4950,  actuals: rDec(8628.60, 13828.60) },
  { kind: "input", key: "socso",       label: "Socso (yer)",         sign: -1, budget: 765,   actuals: r(600) },
  { kind: "input", key: "eis",         label: "EIS (yer)",           sign: -1, budget: 85.20, actuals: r(100) },
  { kind: "input", key: "sdl_sg",      label: "SDL (SG) @3.3",       sign: -1, budget: 36.30, actuals: r(36.30) },
  { kind: "input", key: "incentive",   label: "INCENTIVE",           sign: -1, budget: 0,     actuals: r(0) },
  { kind: "subtotal", key: "total_salaries", label: "Total Salaries", sign: -1,
    members: ["payroll_my","payroll_sg","epf_cpf","socso","eis","sdl_sg","incentive"] },

  { kind: "group", label: "Expenses" },
  { kind: "sub", label: "Fixed" },
  { kind: "input", key: "rental",       label: "Rental Expenses",         sign: -1, budget: 4200, actuals: r(4200) },
  { kind: "input", key: "sinking_fund", label: "Sinking Fund",            sign: -1, budget: 0,    actuals: r(0) },
  { kind: "input", key: "maintenance",  label: "Maintenance Service Charge", sign: -1, budget: 0, actuals: r(0) },
  { kind: "input", key: "delivery",     label: "Delivery/Transport Charges (Grab + courier)", sign: -1, budget: 100, actuals: r(100) },
  { kind: "input", key: "samples",      label: "Samples Purchase",        sign: -1, budget: 500,  actuals: r(500) },
  { kind: "input", key: "company_trip", label: "Company Trip, Overseas Trip, Culture", sign: -1, budget: 1000, actuals: r(1000) },
  { kind: "input", key: "sponsorships", label: "Sponsorships & Others",   sign: -1, budget: 500,  actuals: r(500) },
  { kind: "input", key: "team_bonus",   label: "Team Bonus",              sign: -1, budget: 0,    actuals: rDec(0, 40000) },
  { kind: "input", key: "entertainment",label: "Entertainment",           sign: -1, budget: 2000, actuals: r(2000) },

  { kind: "sub", label: "Professional Services" },
  { kind: "input", key: "fin_perfectaim", label: "Finance Team (Perfect Aim Service)", sign: -1, budget: 3500, actuals: r(3500) },
  { kind: "input", key: "fin_sg",          label: "Finance Team (SG)",      sign: -1, budget: 825,  actuals: r(825) },
  { kind: "input", key: "secretary",       label: "Secretary Fee",          sign: -1, budget: 120,  actuals: r(65) },
  { kind: "input", key: "cosec_sg",        label: "Co Sec (SG)",            sign: -1, budget: 500,  actuals: r(220) },
  { kind: "input", key: "filing",          label: "Filing Fee",             sign: -1, budget: 60,   actuals: r(60) },
  { kind: "input", key: "tax_agent",       label: "Tax Agent Fee",          sign: -1, budget: 200,  actuals: r(200) },
  { kind: "input", key: "audit",           label: "Audit Fee",              sign: -1, budget: 10000, actuals: rDec(500, 4500) },
  { kind: "input", key: "stripe",          label: "Stripe Fee",             sign: -1, budget: 500,  actuals: r(500) },
  { kind: "input", key: "digital_mkt",     label: "Digital Marketing",      sign: -1, budget: 40000, actuals: r(3300) },
  { kind: "input", key: "ads_spend",       label: "Ads Spend",              sign: -1, budget: 4000, actuals: r(4000) },
  { kind: "input", key: "mkt_materials",   label: "Marketing Materials",    sign: -1, budget: 1500, actuals: r(1500) },
  { kind: "input", key: "tech_dev",        label: "Tech & Developer Team",  sign: -1, budget: 0,    actuals: r(0) },
  { kind: "input", key: "cleaning",        label: "Cleaning Service (Jasin)", sign: -1, budget: 200, actuals: r(200) },
  { kind: "input", key: "misc_prof",       label: "Miscellaneous (spending, helpers, subs, etc)", sign: -1, budget: 0, actuals: r(0) },

  { kind: "sub", label: "Subscriptions" },
  { kind: "input", key: "sub_google",   label: "Google Workspace",        sign: -1, budget: 800, actuals: r(800) },
  { kind: "input", key: "sub_chatgpt",  label: "ChatGPT",                 sign: -1, budget: 150, actuals: r(150) },
  { kind: "input", key: "sub_octopus",  label: "Email Octopus",           sign: -1, budget: 200, actuals: r(200) },
  { kind: "input", key: "sub_canva",    label: "Canva",                   sign: -1, budget: 250, actuals: r(250) },
  { kind: "input", key: "sub_other",    label: "Other Subscriptions",     sign: -1, budget: 100, actuals: r(100) },
  { kind: "input", key: "sub_hosting",  label: "Hosting for www (Namecheap)", sign: -1, budget: 0, actuals: r(0) },
  { kind: "input", key: "sub_systeme",  label: "Systeme.io",              sign: -1, budget: 0,   actuals: r(0) },
  { kind: "input", key: "sub_misc",     label: "Miscellaneous Subscription", sign: -1, budget: 0, actuals: r(0) },

  { kind: "sub", label: "Variable — Utilities" },
  { kind: "input", key: "util_electric", label: "Electricity",            sign: -1, budget: 450,    actuals: r(450) },
  { kind: "input", key: "util_water",    label: "Water",                  sign: -1, budget: 35.80,  actuals: r(35.80) },
  { kind: "input", key: "util_internet", label: "Internet",               sign: -1, budget: 262.88, actuals: r(262.88) },
  { kind: "input", key: "util_phone",    label: "Phone Bill (Puteri + King)", sign: -1, budget: 150, actuals: r(150) },

  { kind: "sub", label: "Variable — Office Supplies" },
  { kind: "input", key: "off_stationery", label: "Stationery, Printing, Paper Items", sign: -1, budget: 80, actuals: r(200) },
  { kind: "input", key: "off_pantry",     label: "Pantry & Cleaning Items", sign: -1, budget: 500, actuals: r(500) },
  { kind: "input", key: "off_it",         label: "IT Supplies",            sign: -1, budget: 100, actuals: r(100) },
  { kind: "input", key: "off_furniture",  label: "Furniture and Fittings", sign: -1, budget: 0,   actuals: r(0) },

  { kind: "sub", label: "Variable — Vehicle Upkeep & Maintenance" },
  { kind: "input", key: "veh_insurance", label: "Motor Insurance",         sign: -1, budget: 1000, actuals: r(1000) },
  { kind: "input", key: "veh_service",   label: "Car Service",             sign: -1, budget: 200,  actuals: r(200) },

  { kind: "subtotal", key: "total_expenses", label: "Total Expenses",
    members: ["rental","sinking_fund","maintenance","delivery","samples","company_trip","sponsorships","team_bonus","entertainment",
              "fin_perfectaim","fin_sg","secretary","cosec_sg","filing","tax_agent","audit","stripe","digital_mkt","ads_spend","mkt_materials","tech_dev","cleaning","misc_prof",
              "sub_google","sub_chatgpt","sub_octopus","sub_canva","sub_other","sub_hosting","sub_systeme","sub_misc",
              "util_electric","util_water","util_internet","util_phone",
              "off_stationery","off_pantry","off_it","off_furniture",
              "veh_insurance","veh_service"], sign: -1 },
  { kind: "subtotal", key: "total_opex", label: "Total Operating Expenses",
    members: ["total_salaries","total_expenses"], sign: -1, emphasis: true },

  { kind: "group", label: "Below the line" },
  { kind: "input", key: "depreciation", label: "Depreciation *",          sign: -1, budget: 9862, actuals: r(8500) },

  { kind: "sub", label: "Loans" },
  { kind: "input", key: "loan_proton", label: "Car Loan Proton X50",      sign: -1, budget: 1426, actuals: r(1426) },
  { kind: "input", key: "loan_denza",  label: "Car Loan Denza D9",        sign: -1, budget: 2730, actuals: r(2730) },
  { kind: "input", key: "loan_maybank",label: "Maybank RM 300k Loan",     sign: -1, budget: 4382, actuals: r(4382) },
  { kind: "subtotal", key: "total_loans", label: "Total Loans", members: ["loan_proton","loan_denza","loan_maybank"], sign: -1 },

  { kind: "input", key: "cp204", label: "CP204 Tax Installment *",        sign: -1, budget: 3480, actuals: r(290) },

  { kind: "net", key: "net_profit", label: "Net Profit Before Tax",
    income: ["total_sales"],
    deduct: ["total_cogs","total_opex","depreciation","total_loans","cp204"] },
  { kind: "npm", key: "npm", label: "Net Profit Margin %", net: "net_profit", base: "total_sales" },
];

export const BUDGET_INPUT_KEYS = BUDGET_STRUCTURE.filter(x => x.kind === "input").map(x => x.key);
export const BUDGET_LABELS = Object.fromEntries(
  BUDGET_STRUCTURE.filter(x => x.key).map(x => [x.key, x.label])
);
