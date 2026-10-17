import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  attributeDealSales,
  dealForSalesEntry,
  dealsInRange,
  isMissingDealLinkColumn,
  isUnlinkedSalesClosed,
  mergeAchievedFromDeals,
  salesClosedByDealMonth,
  salesLinkMigrationSql,
  scoreboardSalesRollup,
  splitMoney,
  sumDealAmounts,
  validateSalesEntry,
} from "./sales-source.js";

const DEALS = [
  { id: "deloitte", project_name: "Deloitte Milestone", amount_myr: 74240, deal_close_date: "2026-10-02" },
  { id: "instructure", project_name: "Instructure", aca_id: "S00601", amount_myr: 20547.7, deal_close_date: "2026-10-08", sales_entry_id: 3 },
  { id: "swag", project_name: "AWS Mun Pin SWAG", amount_myr: 100, deal_close_date: "2026-10-11" },
  { id: "sept", project_name: "September job", amount_myr: 50, deal_close_date: "2026-09-30" },
];

const ENTRIES = [
  { id: 1, user_id: 8, category: "sales_closed", client_name: "Deloitte Milestone", amount: 74240, entry_date: "2026-10-02" },
  { id: 2, user_id: 2, category: "sales_closed", client_name: "AWS Mun Pin SWAG", amount: 61290.47, entry_date: "2026-10-11" },
  { id: 3, user_id: 6, category: "sales_closed", client_name: "Instructure", amount: 20706.2, entry_date: "2026-10-08" },
  { id: 4, user_id: 8, category: "sales_closed", client_name: "Deloitte part", amount: 40000, entry_date: "2026-10-03", deal_id: "deloitte" },
  { id: 5, user_id: 2, category: "sales_closed", client_name: "Deloitte part 2", amount: 34240, entry_date: "2026-10-04", deal_id: "deloitte" },
  { id: 6, user_id: 2, category: "pipeline", client_name: "Maybe", amount: 999, entry_date: "2026-10-04" },
];

test("monthly achieved follows deal close dates, not Scoreboard amounts", () => {
  const byMonth = salesClosedByDealMonth(DEALS, 2026);
  assert.equal(byMonth.Oct, 94887.7);
  assert.equal(byMonth.Sep, 50);
  assert.equal(byMonth.Nov, undefined);
  const rows = mergeAchievedFromDeals(
    [{ month: "Oct", year: 2026, target: 500000, achieved: 1 }],
    DEALS,
    2026,
  );
  assert.equal(rows[0].achieved, 94887.7);
  assert.equal(rows[0].target, 500000);
});

test("an unlinked Scoreboard row is kept and excluded from the range total", () => {
  assert.equal(isUnlinkedSalesClosed(ENTRIES[0], DEALS), true);
  assert.equal(isUnlinkedSalesClosed(ENTRIES[1], DEALS), true);
  assert.equal(isUnlinkedSalesClosed(ENTRIES[2], DEALS), false);
  assert.equal(isUnlinkedSalesClosed(ENTRIES[5], DEALS), false);
  const rollup = scoreboardSalesRollup(DEALS, ENTRIES, "2026-10-01", "2026-10-31");
  assert.equal(rollup.count, 3);
  assert.equal(rollup.total, 94887.7);
  assert.equal(sumDealAmounts(dealsInRange(DEALS, "2026-10-01", "2026-10-31")), rollup.total);
  assert.ok(rollup.total < ENTRIES.filter(e => e.category === "sales_closed").reduce((s, e) => s + e.amount, 0));
});

test("several Scoreboard rows can share one deal without double-counting", () => {
  const rollup = attributeDealSales(DEALS.filter(d => d.deal_close_date.startsWith("2026-10")), ENTRIES);
  assert.equal(rollup.byUserId["8"], 40000);
  assert.equal(rollup.byUserId["2"], 34240);
  assert.equal(rollup.byUserId["6"], 20547.7);
  assert.equal(rollup.unassigned, 100);
  assert.equal(rollup.unassignedDeals[0].project_name, "AWS Mun Pin SWAG");
  const people = Object.values(rollup.byUserId).reduce((s, n) => s + n, 0);
  assert.equal(Math.round((people + rollup.unassigned) * 100) / 100, rollup.total);
});

test("two rows that both copied the full deal split it evenly", () => {
  const deal = [{ id: "job", amount_myr: 100, deal_close_date: "2026-10-01" }];
  const entries = [
    { id: 1, user_id: 2, deal_id: "job", amount: 100, category: "sales_closed" },
    { id: 2, user_id: 6, deal_id: "job", amount: 100, category: "sales_closed" },
  ];
  const rollup = attributeDealSales(deal, entries);
  assert.equal(rollup.total, 100);
  assert.equal(rollup.byUserId["2"], 50);
  assert.equal(rollup.byUserId["6"], 50);
});

test("partial amounts on one person still count the deal once", () => {
  const deal = [{ id: "job", amount_myr: 100, deal_close_date: "2026-10-01" }];
  const entries = [
    { id: 1, user_id: 2, deal_id: "job", amount: 70, category: "sales_closed" },
    { id: 2, user_id: 2, deal_id: "job", amount: 30, category: "sales_closed" },
  ];
  const rollup = attributeDealSales(deal, entries);
  assert.equal(rollup.byUserId["2"], 100);
  assert.equal(rollup.unassigned, 0);
});

test("the legacy one-to-one Scoreboard link still counts as linked", () => {
  const entry = ENTRIES[2];
  assert.equal(dealForSalesEntry(entry, DEALS).id, "instructure");
  assert.equal(isUnlinkedSalesClosed(entry, DEALS), false);
  const shares = splitMoney(10.01, [{ key: "a", weight: 1 }, { key: "b", weight: 1 }, { key: "c", weight: 1 }]);
  assert.equal(shares.reduce((s, row) => s + row.amount, 0), 10.01);
});

test("new Sales Closed rows need a deal; other categories do not", () => {
  assert.deepEqual(validateSalesEntry({
    category: "sales_closed", clientName: "Acme", amount: "10", entryDate: "2026-10-01", dealId: "",
  }), ["Pick a Traffic Board deal. Sales Closed has to be linked to one."]);
  assert.deepEqual(validateSalesEntry({
    category: "sales_closed", clientName: "Acme", amount: "10", entryDate: "2026-10-01", dealId: "job",
  }), []);
  assert.deepEqual(validateSalesEntry({
    category: "pipeline", clientName: "Acme", amount: "10", entryDate: "2026-10-01", dealId: "",
  }), []);
  assert.equal(isMissingDealLinkColumn({ code: "PGRST204", message: "Could not find the 'deal_id' column" }), true);
  assert.equal(isMissingDealLinkColumn({ message: "network down" }), false);
});

test("sales-link migration only adds a nullable deal link", () => {
  const sql = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  const section = salesLinkMigrationSql(sql);
  assert.match(section, /add column if not exists deal_id uuid references traffic_deals\(id\) on delete set null/i);
  assert.match(section, /create index if not exists sales_entries_deal_id_idx/i);
  assert.doesNotMatch(section, /\b(delete|update)\s+sales_entries\b/i);
  assert.doesNotMatch(section, /\bdrop\s+column\b/i);
  assert.doesNotMatch(section, /traffic_deals_sales_entry_uidx/);
});
