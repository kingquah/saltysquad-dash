// Scoreboard rows are the live tally (keyed in while paperwork is still pending).
// Traffic Board deals are the record. Reconciliation compares the two and never
// blocks entry. Budget revenue and COGS use only deals the Traffic Board already
// treats as Final: at least one cost row, and costs_locked.

import { BUDGET_MONTHS } from "./budget-data.js";
import { deriveDeal, money } from "./traffic-board-logic.js";

function dayOf(value) {
  const day = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function monthName(day, year) {
  if (!day || !day.startsWith(`${year}-`)) return null;
  return BUDGET_MONTHS[Number(day.slice(5, 7)) - 1] || null;
}

function addMonth(bucket, name, amount) {
  bucket[name] = money((bucket[name] || 0) + amount);
}

export function salesClosedByEntryMonth(entries, year) {
  const out = {};
  for (const entry of entries || []) {
    const name = monthName(dayOf(entry?.entry_date), year);
    if (!name) continue;
    addMonth(out, name, money(entry.amount));
  }
  return out;
}

// Every recorded deal, by deal close date. This is the reconciliation total,
// including deals whose costs are still pending or provisional.
export function salesClosedByDealMonth(deals, year) {
  const out = {};
  for (const deal of deals || []) {
    const name = monthName(dayOf(deal?.deal_close_date), year);
    if (!name) continue;
    addMonth(out, name, money(deal.amount_myr ?? deal.amount));
  }
  return out;
}

export function dealsInRange(deals, from, to) {
  const start = from ? String(from).slice(0, 10) : null;
  const end = to ? String(to).slice(0, 10) : null;
  return (deals || []).filter(deal => {
    const day = dayOf(deal?.deal_close_date);
    if (!day) return false;
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  });
}

export function sumDealAmounts(deals) {
  return money((deals || []).reduce((sum, deal) => sum + money(deal?.amount_myr ?? deal?.amount), 0));
}

// Same rule as the Traffic Board margin: no cost rows is "Cost pending"
// (even if costs_locked), costs without the lock are "provisional", and
// costs plus the lock are "final". A locked 0-amount cost row is final.
export function dealIsFinal(deal, costs) {
  if (!deal) return false;
  return deriveDeal(deal, [], costs || [], "2099-01-01").margin.state === "final";
}

// Sales and COGS land in the deal's close month, not the cost date.
export function finalisedByMonth(deals, costs, year) {
  const costsByDeal = new Map();
  for (const cost of costs || []) {
    if (cost?.deal_id == null) continue;
    const id = String(cost.deal_id);
    if (!costsByDeal.has(id)) costsByDeal.set(id, []);
    costsByDeal.get(id).push(cost);
  }
  const sales = {};
  const cogs = {};
  for (const deal of deals || []) {
    const name = monthName(dayOf(deal?.deal_close_date), year);
    if (!name) continue;
    const mine = costsByDeal.get(String(deal.id)) || [];
    if (!dealIsFinal(deal, mine)) continue;
    addMonth(sales, name, money(deal.amount_myr ?? deal.amount));
    addMonth(cogs, name, mine.reduce((sum, cost) => sum + money(cost.amount), 0));
  }
  return { sales, cogs };
}

export function reconcileSales(live, board) {
  const liveAmount = money(live);
  const boardAmount = money(board);
  return { live: liveAmount, board: boardAmount, gap: money(liveAmount - boardAmount) };
}

export const PAPERWORK_PENDING = "Pending paperwork (on Scoreboard, not yet on Traffic Board)";
export const PAPERWORK_AHEAD = "On Traffic Board, not on the Scoreboard";
export const PAPERWORK_MATCH = "Scoreboard and Traffic Board match";

export function paperworkNote(gap) {
  const value = money(gap);
  if (value > 0) return PAPERWORK_PENDING;
  if (value < 0) return PAPERWORK_AHEAD;
  return PAPERWORK_MATCH;
}
