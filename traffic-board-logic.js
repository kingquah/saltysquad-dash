// Pure rules for the Traffic Board. No network. The UI and tests both use this
// so collection status and margin never drift into a YES/NO flag or a fake 100%.

export const ENTITIES = [
  { id: "saltyskins_my", label: "Saltyskins MY", short: "MY" },
  { id: "saltycustoms_sg", label: "Saltycustoms SG", short: "SG" },
];

export const COST_TYPES = [
  { id: "fabric_print", label: "Fabric / print" },
  { id: "logistics", label: "Logistics" },
  { id: "misc", label: "Misc" },
  { id: "other", label: "Other" },
];

export const SALES_TYPES = ["Project", "Retainer", "One-off", "Sample", "Repeat"];

export const DEAL_FIELDS = [
  { key: "project_name", label: "Project name" },
  { key: "aca_id", label: "ACA ID" },
  { key: "entity", label: "Entity" },
  { key: "ac_in_charge", label: "AC in charge" },
  { key: "lead_owner", label: "Lead owner" },
  { key: "product", label: "Product" },
  { key: "qty", label: "Qty" },
  { key: "deal_close_date", label: "Deal close date" },
  { key: "sales_type", label: "Sales type" },
  { key: "amount_myr", label: "Amount MYR" },
  { key: "payment_terms", label: "Payment terms" },
  { key: "expected_collection_date", label: "Expected collection date" },
  { key: "sales_entry_id", label: "Scoreboard link" },
];

const FIELD_LABEL = Object.fromEntries([
  ...DEAL_FIELDS.map(f => [f.key, f.label]),
  ["costs_locked", "Costs locked"],
  ["deal", "Deal"],
  ["collection", "Collection"],
  ["cost", "Cost"],
]);

export function entityLabel(id) {
  return ENTITIES.find(e => e.id === id)?.label || id || "—";
}

export function costTypeLabel(id) {
  return COST_TYPES.find(t => t.id === id)?.label || id || "—";
}

export function fieldLabel(key) {
  return FIELD_LABEL[key] || key;
}

export function money(n) {
  if (n == null || n === "") return 0;
  const v = Number(typeof n === "string" ? n.trim() : n);
  if (!Number.isFinite(v)) return 0;
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export function formatRM(v) {
  const n = money(v);
  const sign = n < 0 ? "-" : "";
  const [whole, frac] = Math.abs(n).toFixed(2).split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `RM ${sign}${withCommas}.${frac}`;
}

export function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthKeyFromDate(d = new Date()) {
  return todayISO(d).slice(0, 7);
}

export function monthKey(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr);
  return s.length >= 7 ? s.slice(0, 7) : null;
}

export function blankToNull(s) {
  const t = String(s ?? "").trim();
  return t ? t : null;
}

function normQty(v) {
  if (v == null || String(v).trim() === "") return null;
  return money(v);
}

export function normalizeDealInput(form) {
  const salesId = form.sales_entry_id === "" || form.sales_entry_id == null
    ? null
    : Number(form.sales_entry_id);
  return {
    project_name: String(form.project_name || "").trim(),
    aca_id: blankToNull(form.aca_id),
    entity: form.entity || "",
    ac_in_charge: blankToNull(form.ac_in_charge),
    lead_owner: blankToNull(form.lead_owner),
    product: blankToNull(form.product),
    qty: normQty(form.qty),
    deal_close_date: blankToNull(form.deal_close_date),
    sales_type: blankToNull(form.sales_type),
    amount_myr: money(form.amount_myr),
    payment_terms: blankToNull(form.payment_terms),
    expected_collection_date: blankToNull(form.expected_collection_date),
    sales_entry_id: Number.isFinite(salesId) ? salesId : null,
  };
}

export function validateDeal(input) {
  const errors = [];
  if (!input.project_name) errors.push("Project name is required.");
  if (!ENTITIES.some(e => e.id === input.entity)) errors.push("Pick Saltyskins MY or Saltycustoms SG.");
  if (!(input.amount_myr >= 0)) errors.push("Amount must be zero or more.");
  return errors;
}

export function validateCollection(row) {
  const errors = [];
  if (!row.collected_at) errors.push("Collection needs a date.");
  if (!(money(row.amount) > 0)) errors.push("Collection amount must be more than zero.");
  return errors;
}

export function validateCost(row) {
  const errors = [];
  if (!row.cost_date) errors.push("Cost needs a date.");
  if (!COST_TYPES.some(t => t.id === row.cost_type)) errors.push("Pick a cost type.");
  if (row.amount === "" || row.amount == null || !Number.isFinite(Number(row.amount)) || money(row.amount) < 0) {
    errors.push("Cost amount must be zero or more. Use 0 only when you have confirmed there is no cost.");
  }
  return errors;
}

export function sumAmounts(rows) {
  return money((rows || []).reduce((s, r) => s + money(r.amount), 0));
}

// Open / Partial / Collected / Overdue. Collected wins over a past expected date.
// A partial receipt that is past the expected date is Overdue — money is still owed.
export function collectionStatus(amount, collected, expectedDate, today) {
  const amt = money(amount);
  const col = money(collected);
  const remaining = money(amt - col);
  if (col + 0.001 >= amt && (amt > 0 || col > 0)) return "Collected";
  const past = !!(expectedDate && String(expectedDate) < String(today));
  if (past && remaining > 0) return "Overdue";
  if (col > 0 && remaining > 0) return "Partial";
  return "Open";
}

// No cost rows → always "Cost pending", even if costs_locked was set by mistake.
// A recorded 0-cost row is a real entry, so margin can be calculated.
export function marginView(amount, costs, costsLocked) {
  const amt = money(amount);
  const list = costs || [];
  if (list.length === 0) {
    return { state: "pending", label: "Cost pending", cogs: 0, gp: null, pct: null };
  }
  const cogs = sumAmounts(list);
  const gp = money(amt - cogs);
  const pct = amt > 0 ? Math.round((gp / amt) * 1000) / 10 : null;
  const state = costsLocked ? "final" : "provisional";
  return {
    state,
    label: state === "final" ? "Final" : "Provisional",
    cogs,
    gp,
    pct,
  };
}

export function marginText(margin) {
  if (!margin || margin.state === "pending") return "Cost pending";
  const pct = margin.pct == null ? "" : ` · ${margin.pct.toFixed(1)}%`;
  return `${margin.label} · ${formatRM(margin.gp)}${pct}`;
}

export function canLockCosts(costs) {
  return (costs || []).length > 0;
}

export function deriveDeal(deal, collections, costs, today) {
  const amount = money(deal.amount_myr);
  const mineC = (collections || []).filter(c => c.deal_id === deal.id);
  const mineK = (costs || []).filter(c => c.deal_id === deal.id);
  const collected = sumAmounts(mineC);
  const remaining = money(Math.max(0, amount - collected));
  const overpaid = money(Math.max(0, collected - amount));
  const margin = marginView(amount, mineK, !!deal.costs_locked);
  const status = collectionStatus(amount, collected, deal.expected_collection_date, today);
  return {
    ...deal,
    amount,
    collected,
    remaining,
    overpaid,
    status,
    margin,
    collections: mineC,
    costs: mineK,
  };
}

export function filterDeals(derived, { month = "all", entity = "all", search = "" } = {}) {
  const q = String(search || "").trim().toLowerCase();
  return derived.filter(d => {
    if (month && month !== "all" && monthKey(d.deal_close_date) !== month) return false;
    if (entity && entity !== "all" && d.entity !== entity) return false;
    if (!q) return true;
    const hay = [d.project_name, d.aca_id, d.product, d.ac_in_charge, d.lead_owner, d.sales_type]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function summarize(deals) {
  const s = {
    count: deals.length,
    sales: 0,
    collected: 0,
    owed: 0,
    cogs: 0,
    provisionalGp: 0,
    finalGp: 0,
    provisionalCount: 0,
    finalCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    overdueOwed: 0,
  };
  for (const d of deals) {
    s.sales = money(s.sales + d.amount);
    s.collected = money(s.collected + d.collected);
    s.owed = money(s.owed + d.remaining);
    if (d.margin.state === "pending") {
      s.pendingCount += 1;
    } else {
      s.cogs = money(s.cogs + d.margin.cogs);
      if (d.margin.state === "provisional") {
        s.provisionalGp = money(s.provisionalGp + d.margin.gp);
        s.provisionalCount += 1;
      } else {
        s.finalGp = money(s.finalGp + d.margin.gp);
        s.finalCount += 1;
      }
    }
    if (d.status === "Overdue") {
      s.overdueCount += 1;
      s.overdueOwed = money(s.overdueOwed + d.remaining);
    }
  }
  return s;
}

export function gpText(count, amount) {
  if (!count) return "—";
  return formatRM(amount);
}

export function groupByEntity(deals, entityFilter = "all") {
  const source = entityFilter && entityFilter !== "all"
    ? ENTITIES.filter(e => e.id === entityFilter)
    : ENTITIES;
  const groups = source.map(e => ({ ...e, deals: deals.filter(d => d.entity === e.id) }));
  if (!entityFilter || entityFilter === "all") {
    const known = new Set(ENTITIES.map(e => e.id));
    const other = deals.filter(d => !known.has(d.entity));
    if (other.length) groups.push({ id: "other", label: "Other", short: "?", deals: other });
  }
  return groups;
}

function displayField(key, value) {
  if (value == null || value === "") return "—";
  if (key === "entity") return entityLabel(value);
  if (key === "amount_myr") return formatRM(value);
  if (key === "sales_entry_id") return `#${value}`;
  return String(value);
}

function sameValue(key, a, b) {
  if (key === "amount_myr" || key === "qty") {
    const na = a == null || a === "" ? null : money(a);
    const nb = b == null || b === "" ? null : money(b);
    return na === nb;
  }
  return String(a ?? "") === String(b ?? "");
}

export function dealAuditDiff(before, after) {
  const rows = [];
  for (const f of DEAL_FIELDS) {
    if (sameValue(f.key, before?.[f.key], after?.[f.key])) continue;
    rows.push({
      field: f.key,
      old_value: displayField(f.key, before?.[f.key]),
      new_value: displayField(f.key, after?.[f.key]),
    });
  }
  return rows;
}

export function dealSnapshot(deal) {
  const aca = deal.aca_id ? deal.aca_id : "no ACA ID";
  return `${deal.project_name} · ${aca} · ${entityLabel(deal.entity)} · ${formatRM(deal.amount_myr)}`;
}

export function collectionSnapshot(row) {
  const note = row.note ? ` · ${row.note}` : "";
  return `${row.collected_at} · ${formatRM(row.amount)}${note}`;
}

export function costSnapshot(row) {
  const note = row.note ? ` · ${row.note}` : "";
  return `${row.cost_date} · ${costTypeLabel(row.cost_type)} · ${formatRM(row.amount)}${note}`;
}

export function defaultCollectionDraft(remaining, today) {
  return {
    collected_at: today,
    amount: remaining > 0 ? remaining.toFixed(2) : "",
    note: "",
  };
}

export function auditSentence(row) {
  const who = row.user_name || "Someone";
  const proj = row.project_name || "a deal";
  if (row.field === "deal" && (row.old_value == null || row.old_value === "") && row.new_value) {
    return `${who} added ${row.new_value}`;
  }
  if (row.field === "deal" && row.new_value === "deleted") {
    return `${who} deleted ${row.old_value}`;
  }
  if (row.field === "collection" && (row.old_value == null || row.old_value === "")) {
    return `${who} recorded a collection on ${proj}: ${row.new_value}`;
  }
  if (row.field === "collection" && (row.new_value == null || row.new_value === "")) {
    return `${who} removed a collection on ${proj}: ${row.old_value}`;
  }
  if (row.field === "cost" && (row.old_value == null || row.old_value === "")) {
    return `${who} entered a cost on ${proj}: ${row.new_value}`;
  }
  if (row.field === "cost" && (row.new_value == null || row.new_value === "")) {
    return `${who} removed a cost on ${proj}: ${row.old_value}`;
  }
  if (row.field === "costs_locked") {
    return row.new_value === "locked"
      ? `${who} locked costs on ${proj}`
      : `${who} unlocked costs on ${proj}`;
  }
  const what = fieldLabel(row.field);
  if (row.old_value == null || row.old_value === "—") {
    return `${who} set ${what} on ${proj} to ${row.new_value}`;
  }
  if (row.new_value == null || row.new_value === "—") {
    return `${who} cleared ${what} on ${proj} (was ${row.old_value})`;
  }
  return `${who} changed ${what} on ${proj}: ${row.old_value} → ${row.new_value}`;
}

export function isMissingTableError(error) {
  const msg = `${error?.message || ""} ${error?.code || ""} ${error?.details || ""}`;
  return /does not exist|PGRST205|42P01|schema cache|Could not find the table/i.test(msg);
}

export function friendlyWriteError(error) {
  const msg = `${error?.message || ""} ${error?.details || ""}`;
  if (/traffic_deals_aca_id_uidx|aca_id/i.test(msg) && /duplicate|unique/i.test(msg)) {
    return "That ACA ID is already on the board. Open the existing job and add a collection or a cost there.";
  }
  if (/traffic_deals_sales_entry_uidx|sales_entry_id/i.test(msg) && /duplicate|unique/i.test(msg)) {
    return "That Scoreboard row is already linked to another job.";
  }
  return error?.message || "Save failed.";
}
