import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { computeBudgetRows } from "./budget-data.js";
import {
  PAPERWORK_AHEAD,
  PAPERWORK_MATCH,
  PAPERWORK_PENDING,
  dealIsFinal,
  dealsInRange,
  finalisedByMonth,
  paperworkNote,
  reconcileSales,
  salesClosedByDealMonth,
  salesClosedByEntryMonth,
  sumDealAmounts,
} from "./sales-source.js";

const FINAL = { id: "final", amount_myr: 1000, deal_close_date: "2026-10-02", costs_locked: true };
const FINAL_COSTS = [
  { deal_id: "final", amount: 250, cost_date: "2026-11-15" },
  { deal_id: "final", amount: 50, cost_date: "2026-12-01" },
];

test("budget months follow the strings, not timezone-shifted dates", () => {
  const byMonth = salesClosedByEntryMonth([
    { amount: 10.1, entry_date: "2026-10-01" },
    { amount: 0.2, entry_date: "2026-10-31" },
    { amount: 5, entry_date: "2025-10-01" },
  ], 2026);
  assert.equal(byMonth.Oct, 10.3);
  assert.equal(byMonth.Sep, undefined);
});

test("reconciliation counts every recorded deal, final or not", () => {
  const deals = [
    FINAL,
    { id: "open", amount_myr: 40, deal_close_date: "2026-10-20", costs_locked: false },
    { id: "sept", amount_myr: 7, deal_close_date: "2026-09-30", costs_locked: true },
    { id: "blank", amount_myr: 99, deal_close_date: null, costs_locked: true },
  ];
  assert.equal(salesClosedByDealMonth(deals, 2026).Oct, 1040);
  assert.equal(salesClosedByDealMonth(deals, 2026).Sep, 7);
  assert.equal(sumDealAmounts(dealsInRange(deals, "2026-10-01", "2026-10-31")), 1040);
});

test("only a locked deal with at least one cost is final", () => {
  assert.equal(dealIsFinal(FINAL, FINAL_COSTS), true);
  assert.equal(dealIsFinal({ ...FINAL, costs_locked: true }, []), false);
  assert.equal(dealIsFinal({ ...FINAL, costs_locked: false }, FINAL_COSTS), false);
  assert.equal(dealIsFinal({ ...FINAL, id: "zero" }, [{ deal_id: "zero", amount: 0 }]), true);
});

test("finalised sales and COGS use the close month, and skip anything not final", () => {
  const deals = [
    FINAL,
    { id: "pending", amount_myr: 500, deal_close_date: "2026-10-03", costs_locked: true },
    { id: "provisional", amount_myr: 800, deal_close_date: "2026-10-04", costs_locked: false },
    { id: "zero", amount_myr: 200, deal_close_date: "2026-10-05", costs_locked: true },
    { id: "sept", amount_myr: 70, deal_close_date: "2026-09-01", costs_locked: true },
  ];
  const costs = [
    ...FINAL_COSTS,
    { deal_id: "provisional", amount: 100, cost_date: "2026-10-04" },
    { deal_id: "zero", amount: 0, cost_date: "2026-01-01" },
    { deal_id: "sept", amount: 20, cost_date: "2026-10-20" },
  ];
  const { sales, cogs } = finalisedByMonth(deals, costs, 2026);
  assert.equal(sales.Oct, 1200);
  assert.equal(cogs.Oct, 300);
  assert.equal(sales.Sep, 70);
  assert.equal(cogs.Sep, 20);
  assert.equal(sales.Nov, undefined);
  assert.equal(salesClosedByDealMonth(deals, 2026).Oct, 2500);
});

test("the gap is pending paperwork only when the Scoreboard is ahead", () => {
  assert.deepEqual(reconcileSales(100.005, 40), { live: 100.01, board: 40, gap: 60.01 });
  assert.equal(paperworkNote(60.01), PAPERWORK_PENDING);
  assert.equal(paperworkNote(-1), PAPERWORK_AHEAD);
  assert.equal(paperworkNote(0), PAPERWORK_MATCH);
  assert.equal(reconcileSales(10, 10).gap, 0);
});

test("commission-style budget calls do not replace COGS with sales", () => {
  const lines = {
    total_sales: { monthly_budget: 1, actuals: { Jan: 9 } },
    total_cogs: { monthly_budget: 2, actuals: { Jan: 3, Feb: 4 } },
  };
  const scoreboardOnly = computeBudgetRows(lines, { Jan: 100 }, false);
  assert.equal(scoreboardOnly.find(row => row.key === "total_sales").actuals.Jan, 100);
  assert.equal(scoreboardOnly.find(row => row.key === "total_cogs").actuals.Jan, 3);
  assert.equal(scoreboardOnly.find(row => row.key === "total_cogs").actuals.Feb, 4);
  assert.equal(scoreboardOnly.find(row => row.key === "total_cogs").autoActual, false);

  const fromDeals = computeBudgetRows(lines, { Jan: 100 }, false, { Jan: 40 });
  assert.equal(fromDeals.find(row => row.key === "total_sales").actuals.Jan, 100);
  assert.equal(fromDeals.find(row => row.key === "total_cogs").actuals.Jan, 40);
  assert.equal(fromDeals.find(row => row.key === "total_cogs").actuals.Feb, 0);
  assert.equal(fromDeals.find(row => row.key === "total_cogs").autoActual, true);

  const stored = computeBudgetRows(lines, null, false, null);
  assert.equal(stored.find(row => row.key === "total_sales").actuals.Jan, 9);
  assert.equal(stored.find(row => row.key === "total_sales").autoActual, false);
  assert.equal(stored.find(row => row.key === "total_cogs").actuals.Jan, 3);
});

test("no Scoreboard deal-link migration", () => {
  const sql = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  assert.doesNotMatch(sql, /SALES_LINK_MIGRATION/);
  assert.doesNotMatch(sql, /alter table\s+sales_entries[\s\S]{0,200}deal_id/i);
});
