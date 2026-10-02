import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  auditSentence,
  collectionStatus,
  dealAuditDiff,
  deriveDeal,
  filterDeals,
  formatRM,
  friendlyWriteError,
  gpText,
  marginText,
  marginView,
  normalizeDealInput,
  summarize,
  validateCollection,
  validateCost,
} from "./traffic-board-logic.js";

const TODAY = "2026-09-26";

test("blank ACA becomes null and amount is rounded money", () => {
  const row = normalizeDealInput({ project_name: "  Job  ", aca_id: "  ", entity: "saltyskins_my", amount_myr: "10.005", qty: "" });
  assert.equal(row.project_name, "Job");
  assert.equal(row.aca_id, null);
  assert.equal(row.qty, null);
  assert.equal(row.amount_myr, 10.01);
});

test("status: open, partial, overdue partial, collected beats a past date", () => {
  assert.equal(collectionStatus(1000, 0, "2026-10-01", TODAY), "Open");
  assert.equal(collectionStatus(1000, 0, null, TODAY), "Open");
  assert.equal(collectionStatus(1000, 0, TODAY, TODAY), "Open");
  assert.equal(collectionStatus(1000, 400, "2026-10-01", TODAY), "Partial");
  assert.equal(collectionStatus(1000, 400, "2026-09-01", TODAY), "Overdue");
  assert.equal(collectionStatus(1000, 0, "2026-09-01", TODAY), "Overdue");
  assert.equal(collectionStatus(1000, 1000, "2026-09-01", TODAY), "Collected");
  assert.equal(collectionStatus(1000, 1200, "2026-09-01", TODAY), "Collected");
});

test("no cost rows never render as 100% margin, even if locked", () => {
  const pending = marginView(1000, [], true);
  assert.equal(pending.state, "pending");
  assert.equal(pending.pct, null);
  assert.equal(marginText(pending), "Cost pending");
  assert.equal(marginText(pending).includes("100"), false);
});

test("a real zero-cost line can show 100% because a cost was entered", () => {
  const view = marginView(1000, [{ amount: 0 }], false);
  assert.equal(view.state, "provisional");
  assert.equal(view.pct, 100);
  assert.equal(marginText(view), "Provisional · RM 1,000.00 · 100.0%");
  const final = marginView(1000, [{ amount: 250 }], true);
  assert.equal(final.state, "final");
  assert.equal(final.gp, 750);
  assert.equal(final.pct, 75);
  assert.equal(marginText(final), "Final GP RM 750.00 (75.0%)");
  const zeroAmount = marginView(0, [{ amount: 0 }], true);
  assert.equal(zeroAmount.pct, null);
  assert.equal(marginText(zeroAmount), "Final GP RM 0.00");
});

test("summary skips pending jobs in GP and counts overdue remainder", () => {
  const deals = [
    deriveDeal({ id: "a", amount_myr: 1000, expected_collection_date: "2026-10-01", costs_locked: false, deal_close_date: "2026-09-02", entity: "saltyskins_my", project_name: "Open job" }, [], [], TODAY),
    deriveDeal({ id: "b", amount_myr: 1000, expected_collection_date: "2026-09-01", costs_locked: false, deal_close_date: "2026-09-03", entity: "saltycustoms_sg", project_name: "Late job" }, [{ deal_id: "b", amount: 200 }], [{ deal_id: "b", amount: 100 }], TODAY),
    deriveDeal({ id: "c", amount_myr: 400, expected_collection_date: "2026-09-01", costs_locked: true, deal_close_date: "2026-08-01", entity: "saltyskins_my", project_name: "Old" }, [{ deal_id: "c", amount: 400 }], [{ deal_id: "c", amount: 100 }], TODAY),
  ];
  assert.equal(deals[0].status, "Open");
  assert.equal(deals[0].margin.state, "pending");
  assert.equal(deals[1].status, "Overdue");
  assert.equal(deals[1].remaining, 800);
  assert.equal(deals[1].margin.state, "provisional");
  assert.equal(deals[2].status, "Collected");
  assert.equal(deals[2].margin.state, "final");

  const month = filterDeals(deals, { month: "2026-09" });
  assert.deepEqual(month.map(d => d.id), ["a", "b"]);
  const summary = summarize(month);
  assert.equal(summary.sales, 2000);
  assert.equal(summary.collected, 200);
  assert.equal(summary.owed, 1800);
  assert.equal(summary.cogs, 100);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.provisionalGp, 900);
  assert.equal(summary.finalGp, 0);
  assert.equal(summary.finalSales, 0);
  assert.equal(summary.finalPct, null);
  assert.equal(summary.finalCount, 0);
  assert.equal(gpText(summary.finalCount, summary.finalGp, summary.finalPct), "—");
  assert.equal(gpText(summary.provisionalCount, summary.provisionalGp), "RM 900.00");
  assert.equal(summary.overdueCount, 1);
  assert.equal(summary.overdueOwed, 800);
  assert.equal(formatRM(summary.sales), "RM 2,000.00");

  const lockedOnly = summarize(deals.filter(d => d.margin.state === "final"));
  assert.equal(lockedOnly.finalSales, 400);
  assert.equal(lockedOnly.finalGp, 300);
  assert.equal(lockedOnly.finalPct, deals[2].margin.pct);
  assert.equal(gpText(lockedOnly.finalCount, lockedOnly.finalGp, lockedOnly.finalPct), "RM 300.00 (75.0%)");
});

test("final GP card percent is locked gross profit over locked sales only", () => {
  const deals = [
    deriveDeal({ id: "pending", amount_myr: 1000, costs_locked: true, deal_close_date: "2026-09-01", entity: "saltyskins_my", project_name: "No cost" }, [], [], TODAY),
    deriveDeal({ id: "open-cost", amount_myr: 1000, costs_locked: false, deal_close_date: "2026-09-02", entity: "saltyskins_my", project_name: "Unlocked" }, [], [{ deal_id: "open-cost", amount: 400 }], TODAY),
    deriveDeal({ id: "lock-a", amount_myr: 1000, costs_locked: true, deal_close_date: "2026-09-03", entity: "saltyskins_my", project_name: "Locked A" }, [], [{ deal_id: "lock-a", amount: 400 }], TODAY),
    deriveDeal({ id: "lock-b", amount_myr: 500, costs_locked: true, deal_close_date: "2026-09-04", entity: "saltycustoms_sg", project_name: "Locked B" }, [], [{ deal_id: "lock-b", amount: 100 }], TODAY),
  ];
  const summary = summarize(deals);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.provisionalGp, 600);
  assert.equal(summary.finalCount, 2);
  assert.equal(summary.finalSales, 1500);
  assert.equal(summary.finalGp, 1000);
  assert.equal(summary.finalPct, 66.7);
  assert.equal(gpText(summary.provisionalCount, summary.provisionalGp), "RM 600.00");
  assert.equal(gpText(summary.finalCount, summary.finalGp, summary.finalPct), "RM 1,000.00 (66.7%)");
});

test("audit diff is before to after, and sentences name the person", () => {
  const rows = dealAuditDiff(
    { project_name: "Old", amount_myr: 100, entity: "saltyskins_my", aca_id: null },
    { project_name: "New", amount_myr: 150, entity: "saltyskins_my", aca_id: "ACA-1" },
  );
  const fields = rows.map(r => r.field);
  assert.ok(fields.includes("project_name"));
  assert.ok(fields.includes("amount_myr"));
  assert.ok(fields.includes("aca_id"));
  assert.equal(fields.includes("entity"), false);
  const amount = rows.find(r => r.field === "amount_myr");
  assert.equal(amount.old_value, "RM 100.00");
  assert.equal(amount.new_value, "RM 150.00");
  const sentence = auditSentence({ user_name: "King", project_name: "New", field: "amount_myr", old_value: amount.old_value, new_value: amount.new_value });
  assert.match(sentence, /King changed Amount MYR on New: RM 100\.00 → RM 150\.00/);
  assert.match(auditSentence({ user_name: "Puteri", project_name: "New", field: "collection", old_value: null, new_value: "2026-09-26 · RM 50.00" }), /recorded a collection/);
  assert.match(auditSentence({ user_name: "Wilson", project_name: "New", field: "costs_locked", old_value: "unlocked", new_value: "locked" }), /locked costs/);
});

test("collection and cost validation refuse a dateless YES", () => {
  assert.ok(validateCollection({ collected_at: "", amount: 10 }).length > 0);
  assert.ok(validateCollection({ collected_at: "2026-09-26", amount: 0 }).length > 0);
  assert.deepEqual(validateCollection({ collected_at: "2026-09-26", amount: 10 }), []);
  assert.ok(validateCost({ cost_date: "", cost_type: "misc", amount: 0 }).some(e => /date/i.test(e)));
  assert.deepEqual(validateCost({ cost_date: "2026-09-26", cost_type: "misc", amount: 0 }), []);
});

test("duplicate ACA message points back at the existing job", () => {
  const msg = friendlyWriteError({ message: 'duplicate key value violates unique constraint "traffic_deals_aca_id_uidx"' });
  assert.match(msg, /already on the board/);
});

test("production migration section does not touch existing tables or insert money", () => {
  const sql = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  const start = sql.indexOf("-- >>> TRAFFIC_BOARD_MIGRATION_START");
  const end = sql.indexOf("-- >>> TRAFFIC_BOARD_MIGRATION_END");
  assert.ok(start > 0 && end > start);
  const section = sql.slice(start, end);
  assert.match(section, /create table if not exists traffic_deals/);
  assert.match(section, /create table if not exists traffic_collections/);
  assert.match(section, /create table if not exists traffic_costs/);
  assert.match(section, /create table if not exists traffic_audit/);
  assert.match(section, /sales_entry_id\s+integer references sales_entries/);
  assert.match(section, /alter table traffic_deals\s+disable row level security/);
  assert.equal(/alter table users/i.test(section), false);
  assert.equal(/alter table sales_entries/i.test(section), false);
  assert.equal(/alter table budget_/i.test(section), false);
  assert.equal(/enable row level security/i.test(section), false);
  assert.equal(/^\s*insert\s+into\s+traffic/im.test(section), false);
  const demo = sql.slice(end);
  assert.match(demo, /NOT EXECUTED/);
  assert.equal(/^\s*insert\s+into\s+traffic/im.test(demo), false);
});
