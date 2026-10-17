// Company sales totals come from Traffic Board deals (deal close date + amount).
// Scoreboard rows are activity. A Sales Closed row may point at a deal, and
// several rows may point at one deal (partial invoices). Legacy rows with no
// link stay in the table and are left out of every sales total.

import { BUDGET_MONTHS } from "./budget-data.js";
import { formatRM, money } from "./traffic-board-logic.js";

export function salesLinkMigrationSql(sql) {
  const start = String(sql || "").indexOf("-- >>> SALES_LINK_MIGRATION_START");
  const end = String(sql || "").indexOf("-- >>> SALES_LINK_MIGRATION_END");
  if (start < 0 || end < 0) return "";
  const bodyStart = sql.indexOf("\n", start) + 1;
  return sql.slice(bodyStart, end).trim();
}

export function isMissingDealLinkColumn(error) {
  const msg = `${error?.message || ""} ${error?.details || ""} ${error?.hint || ""} ${error?.code || ""}`;
  return /deal_id|42703|PGRST204/i.test(msg);
}

function closeDay(deal) {
  const day = String(deal?.deal_close_date || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function dealAmount(deal) {
  return money(deal?.amount_myr ?? deal?.amount);
}

export function salesClosedByDealMonth(deals, year) {
  const out = {};
  const prefix = `${year}-`;
  for (const deal of deals || []) {
    const day = closeDay(deal);
    if (!day || !day.startsWith(prefix)) continue;
    const name = BUDGET_MONTHS[Number(day.slice(5, 7)) - 1];
    if (!name) continue;
    out[name] = money((out[name] || 0) + dealAmount(deal));
  }
  return out;
}

export function mergeAchievedFromDeals(salesRows, deals, year = new Date().getFullYear()) {
  const sums = salesClosedByDealMonth(deals, year);
  return (salesRows || []).map(row => ({ ...row, achieved: sums[row.month] || 0 }));
}

export function dealsInRange(deals, from, to) {
  const start = from ? String(from).slice(0, 10) : null;
  const end = to ? String(to).slice(0, 10) : null;
  return (deals || []).filter(deal => {
    const day = closeDay(deal);
    if (!day) return false;
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });
}

export function sumDealAmounts(deals) {
  return money((deals || []).reduce((sum, deal) => sum + dealAmount(deal), 0));
}

export function isUnlinkedSalesClosed(entry, deals) {
  if (!entry || entry.category !== "sales_closed") return false;
  if (entry.deal_id) return false;
  const id = String(entry.id);
  return !(deals || []).some(deal => deal.sales_entry_id != null && String(deal.sales_entry_id) === id);
}

export function dealForSalesEntry(entry, deals) {
  if (!entry) return null;
  if (entry.deal_id) {
    return (deals || []).find(deal => String(deal.id) === String(entry.deal_id))
      || { id: entry.deal_id, project_name: "Linked deal", amount_myr: null };
  }
  return (deals || []).find(deal => deal.sales_entry_id != null && String(deal.sales_entry_id) === String(entry.id)) || null;
}

export function validateSalesEntry({ category, clientName, amount, entryDate, dealId }) {
  const errors = [];
  if (!String(clientName || "").trim()) errors.push("Client name is required.");
  if (amount === "" || amount == null || !Number.isFinite(Number(amount))) errors.push("Amount is required.");
  else if (Number(amount) < 0) errors.push("Amount cannot be negative.");
  if (!entryDate) errors.push("Date is required.");
  if (category === "sales_closed" && (dealId == null || String(dealId).trim() === "")) {
    errors.push("Pick a Traffic Board deal. Sales Closed has to be linked to one.");
  }
  return errors;
}

export function dealOptionLabel(deal) {
  const aca = deal?.aca_id ? `${deal.aca_id} · ` : "";
  const date = deal?.deal_close_date || "no close date";
  return `${date} · ${aca}${deal?.project_name || "Untitled"} · ${formatRM(dealAmount(deal))}`;
}

// Last share absorbs the rounding remainder so the parts add up to the deal.
export function splitMoney(total, parts) {
  const rows = (parts || []).map(part => ({
    key: part.key,
    weight: Math.max(0, Number(part.weight) || 0),
  }));
  if (!rows.length) return [];
  const target = money(total);
  const weightSum = rows.reduce((sum, row) => sum + row.weight, 0);
  const weights = weightSum > 0 ? rows.map(row => row.weight) : rows.map(() => 1);
  const scale = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;
  return rows.map((row, index) => {
    const raw = index === rows.length - 1
      ? money(target - assigned)
      : money(Math.min(Math.max(0, target - assigned), target * weights[index] / scale));
    assigned = money(assigned + raw);
    return { key: row.key, amount: raw };
  });
}

function linksForDeal(deal, entries, entryById) {
  const linked = new Map();
  for (const entry of entries || []) {
    if (entry?.deal_id && String(entry.deal_id) === String(deal.id)) linked.set(String(entry.id), entry);
  }
  if (deal?.sales_entry_id != null) {
    const entry = entryById.get(String(deal.sales_entry_id));
    if (entry) linked.set(String(entry.id), entry);
  }
  return [...linked.values()].filter(entry => entry.user_id != null && entry.user_id !== "");
}

// Each deal is counted once. People who logged rows against it split that
// amount in proportion to the row amounts (a partial invoice). Two rows that
// both copied the full deal amount split it evenly, so the team total cannot
// double-count. A deal with no Scoreboard row is unassigned, and still counts.
export function attributeDealSales(deals, entries) {
  const byUserId = {};
  const unassignedDeals = [];
  let unassigned = 0;
  const entryById = new Map((entries || []).map(entry => [String(entry.id), entry]));
  for (const deal of deals || []) {
    const amount = dealAmount(deal);
    const links = linksForDeal(deal, entries, entryById);
    if (!links.length) {
      unassigned = money(unassigned + amount);
      unassignedDeals.push({
        id: deal.id,
        project_name: deal.project_name || "Untitled",
        aca_id: deal.aca_id || null,
        amount,
        deal_close_date: closeDay(deal),
      });
      continue;
    }
    const weights = new Map();
    for (const entry of links) {
      const id = String(entry.user_id);
      weights.set(id, money((weights.get(id) || 0) + money(entry.amount)));
    }
    const parts = [...weights.entries()]
      .map(([key, weight]) => ({ key, weight }))
      .sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
    for (const share of splitMoney(amount, parts)) {
      byUserId[share.key] = money((byUserId[share.key] || 0) + share.amount);
    }
  }
  return {
    total: sumDealAmounts(deals),
    byUserId,
    unassigned,
    unassignedDeals,
  };
}

export function scoreboardSalesRollup(deals, entries, from, to) {
  const inRange = dealsInRange(deals, from, to);
  const attributed = attributeDealSales(inRange, entries);
  return { ...attributed, count: inRange.length };
}
