import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  JULY_2026_DECISION,
  allocateCents,
  buildCommissionMonth,
  buildCommissionYear,
  composeCommissionMonth,
  ensureJulySeed,
  entitySplit,
  julyApprovedBatch,
  personKeyForUser,
  uncollectedCommission,
} from "./commission-logic.js";

const USERS = [
  { id: 1, name: "King Quah", role: "admin" },
  { id: 2, name: "Wilson Goh", role: "supervisor" },
  { id: 3, name: "Puteri Inez", role: "supervisor" },
  { id: 6, name: "Leon Lim", role: "supervisor" },
  { id: 8, name: "Justin Shye", role: "staff" },
];

function line(key, jul, extra = {}) {
  return [key, { monthly_budget: 0, actuals: { Jul: jul }, hidden: false, is_custom: false, ...extra }];
}

function julyLines() {
  return Object.fromEntries([
    line("total_sales", 500000),
    line("total_cogs", 383617.13),
    line("payroll_my", 39700),
    line("epf_cpf", 8628.6),
    line("socso", 600),
    line("eis", 100),
    line("rental", 4800),
    line("samples", 425),
    line("entertainment", 773),
    line("util_electric", 387.52),
    line("util_water", 35.8),
    line("util_internet", 262.88),
    line("util_phone", 130),
    line("off_furniture", 1855.35),
    line("fin_perfectaim", 3500),
    line("secretary", 65),
    line("cosec_sg", 220),
    line("filing", 1424.73),
    line("stripe", 2500),
    line("mkt_materials", 9800),
    line("tech_dev", 7000),
    line("cleaning", 200),
    line("sub_google", 800),
    line("sub_chatgpt", 99),
    line("sub_canva", 112.7),
    line("depreciation", 8500),
    line("loan_denza", 2730),
    line("loan_maybank", 4382),
    line("cp204", 290),
    // Hidden on the Budget tab — must not reduce NPBT.
    line("payroll_sg", 16335, { hidden: true }),
    line("digital_mkt", 3300, { hidden: true }),
  ]);
}

function julySales() {
  return [
    { id: 1, user_id: 2, client_name: "Nokia (Eventually)", amount: 115923.48, entry_date: "2026-07-28" },
    { id: 2, user_id: 2, client_name: "Other July", amount: 275060.78, entry_date: "2026-07-15" },
    { id: 3, user_id: 6, client_name: "Leon book", amount: 52513.25, entry_date: "2026-07-10" },
    { id: 4, user_id: 3, client_name: "Puteri book", amount: 19449.07, entry_date: "2026-07-12" },
    { id: 5, user_id: 3, client_name: "Instructure", amount: 7856.17, entry_date: "2026-07-31" },
    { id: 7, user_id: 8, client_name: "Justin book", amount: 164017.25, entry_date: "2026-07-20" },
  ];
}

function julyDeals() {
  return [
    { id: "nokia", aca_id: "S00359", project_name: "Nokia (Via Eventually)", entity: "saltyskins_my", ac_in_charge: "Wilson", amount_myr: 115923.48, deal_close_date: "2026-07-28" },
    { id: "convo", aca_id: null, project_name: "UNIRAZAK Convo Kit [40%]", entity: "saltyskins_my", ac_in_charge: null, amount_myr: 33600, deal_close_date: "2026-07-15" },
    { id: "kommons", aca_id: "S00415", project_name: "Kommons", entity: "saltyskins_my", ac_in_charge: "Wilson", amount_myr: 26113.25, deal_close_date: "2026-07-31" },
    { id: "reorder", aca_id: null, project_name: "UNIRAZAK Reorder Items [40%]", entity: "saltyskins_my", amount_myr: 9630.4, deal_close_date: "2026-07-15" },
    { id: "shirt", aca_id: null, project_name: "UNIRAZAK Corporate Shirt [40%]", entity: "saltyskins_my", amount_myr: 4680, deal_close_date: "2026-07-15" },
    { id: "gutor", aca_id: "S00403", project_name: "Gutor Earbud", entity: "saltyskins_my", ac_in_charge: "Puteri", amount_myr: 1139.25, deal_close_date: "2026-07-23" },
    { id: "my-paid", aca_id: "S00398", project_name: "Collected MY", entity: "saltyskins_my", ac_in_charge: "Wilson", amount_myr: 206507.83, deal_close_date: "2026-07-21" },
    { id: "sg-paid", aca_id: "S00372", project_name: "Collected SG", entity: "saltycustoms_sg", ac_in_charge: "Shye", amount_myr: 237225.8, deal_close_date: "2026-07-20" },
  ];
}

function julyCosts() {
  return [
    { deal_id: "nokia", amount: 75350.26 },
    { deal_id: "convo", amount: 23280 },
    { deal_id: "kommons", amount: 5623.1 },
    { deal_id: "reorder", amount: 6025.36 },
    { deal_id: "shirt", amount: 2982 },
    { deal_id: "gutor", amount: 330 },
    { deal_id: "my-paid", amount: 1000 },
    { deal_id: "sg-paid", amount: 1000 },
  ];
}

function julyCollections() {
  return [
    { deal_id: "my-paid", amount: 206507.83 },
    { deal_id: "sg-paid", amount: 237225.8 },
  ];
}

function julyInput(overrides = {}) {
  return {
    year: 2026,
    linesMap: julyLines(),
    salesEntries: julySales(),
    deals: julyDeals(),
    collections: julyCollections(),
    costs: julyCosts(),
    exclusions: [{ month_key: "2026-07", aca_id: "S00359", active: true }],
    users: USERS,
    batches: [julyApprovedBatch()],
    ...overrides,
  };
}

function julyMonth(overrides) {
  const input = julyInput(overrides);
  const calc = buildCommissionMonth({ ...input, monthKey: "2026-07" });
  return composeCommissionMonth(calc, input.batches);
}

test("10% of uncollected gross profit, per deal, rounded to the cent", () => {
  assert.equal(uncollectedCommission(33600, 0, 23280).commission, 1032);
  assert.equal(uncollectedCommission(26113.25, 0, 5623.1).commission, 2049.02);
  assert.equal(uncollectedCommission(9630.4, 0, 6025.36).commission, 360.5);
  assert.equal(uncollectedCommission(4680, 0, 2982).commission, 169.8);
  assert.equal(uncollectedCommission(1139.25, 0, 330).commission, 80.93);
  assert.equal(uncollectedCommission(115923.48, 0, 75350.26).commission, 4057.32);
  assert.equal(uncollectedCommission(1000, 1000, 100).commission, 0);
});

test("July 2026 matches King's pool, hold, and approved shares", () => {
  const month = julyMonth();
  assert.ok(Math.abs(month.npbt - 151881.29) < 0.02, `npbt ${month.npbt}`);
  assert.equal(month.npbtExNokia, 111308.07);
  assert.equal(month.qualified, true);
  assert.equal(month.grossPool, 15188.13);
  assert.equal(month.pendingTotal, 4057.32);
  assert.equal(month.pool, 11130.81);
  assert.equal(month.heldTotal, 3692.25);
  assert.equal(month.readyTotal, 7438.56);
  assert.equal(month.useDecision, true);

  const by = Object.fromEntries(month.people.map(p => [p.key, p]));
  for (const key of Object.keys(JULY_2026_DECISION.lines)) {
    const want = JULY_2026_DECISION.lines[key];
    assert.equal(by[key].full, want.full, key);
    assert.equal(by[key].held, want.held, key);
    assert.equal(by[key].readyToPay, want.ready, key);
    assert.equal(by[key].paid, 0, key);
  }
  assert.equal(month.readyPayroll, 7438.56);
  assert.equal(month.people.reduce((s, p) => s + p.held, 0), 3692.25);
  assert.equal(month.people.reduce((s, p) => Math.round((s + p.pending) * 100) / 100, 0), 4057.32);

  const names = month.deals.map(d => d.project_name);
  assert.ok(names.includes("UNIRAZAK Convo Kit [40%]"));
  assert.ok(names.includes("Kommons"));
  assert.ok(names.includes("UNIRAZAK Reorder Items [40%]"));
  assert.ok(names.includes("UNIRAZAK Corporate Shirt [40%]"));
  assert.ok(names.includes("Gutor Earbud"));
  const nokia = month.deals.find(d => d.aca_id === "S00359");
  assert.equal(nokia.statusLabel, "Pending — excluded until collected");
  assert.equal(nokia.amount, 115923.48);
  assert.equal(nokia.collected, 0);
  assert.equal(nokia.outstanding, 115923.48);
  assert.equal(nokia.entityShort, "MY");
  assert.equal(month.deals.find(d => d.aca_id === "S00415").commission, 2049.02);
  assert.equal(month.deals.some(d => d.id === "my-paid"), false);

  assert.deepEqual(month.entityBase, { my: 281670.73, sg: 237225.8 });
  for (const p of month.people) {
    assert.equal(Math.round((p.readyMy + p.readySg) * 100) / 100, p.readyToPay);
  }
});

test("Puteri's Instructure sale counts, and Justin's duplicate does not", () => {
  const calc = buildCommissionMonth({ ...julyInput(), monthKey: "2026-07" });
  const puteri = calc.people.find(p => p.key === "puteri");
  const wilson = calc.people.find(p => p.key === "wilson");
  assert.equal(puteri.grossSales, 27305.24);
  assert.equal(wilson.grossSales, 390984.26);
  assert.equal(wilson.sales, 275060.78);
  assert.equal(calc.pool, 11130.81);
  assert.equal(calc.readyTotal, 7438.56);
  assert.equal(calc.heldTotal, 3692.25);
  assert.equal(wilson.full, 5705.01);
  assert.equal(puteri.full, 1819.56);
  assert.equal(calc.people.find(p => p.key === "king").sales, 0);
  assert.equal(personKeyForUser({ name: "Justin Shye" }), null);
  assert.equal(calc.people.some(p => p.key === "justin"), false);
  const withDuplicate = buildCommissionMonth({
    ...julyInput({
      salesEntries: [...julySales(), { id: 6, user_id: 8, client_name: "Instructure SG", amount: 7856.18, entry_date: "2026-07-28" }],
    }),
    monthKey: "2026-07",
  });
  assert.ok(withDuplicate.npbt > calc.npbt + 7856);
  assert.equal(withDuplicate.pool, 11916.43);
  const withoutPuteriDeal = buildCommissionMonth({
    ...julyInput({ salesEntries: julySales().filter(s => s.id !== 5) }),
    monthKey: "2026-07",
  });
  assert.equal(withoutPuteriDeal.people.find(p => p.key === "puteri").grossSales, 19449.07);
  assert.notEqual(withoutPuteriDeal.people.find(p => p.key === "puteri").pro, puteri.pro);
});

test("July uses King's cents when the live pool and hold still match", () => {
  const month = julyMonth();
  assert.equal(month.useDecision, true);
  assert.equal(month.people.find(p => p.key === "wilson").full, 5705);
  assert.equal(month.people.find(p => p.key === "puteri").full, 1819.57);
  assert.equal(month.people.find(p => p.key === "wilson").readyToPay, 3812.57);
  assert.equal(month.people.find(p => p.key === "puteri").readyToPay, 1215.99);
  assert.equal(month.people.reduce((s, p) => Math.round((s + p.full) * 100) / 100, 0), 11130.81);
  assert.equal(month.people.reduce((s, p) => Math.round((s + p.readyToPay) * 100) / 100, 0), 7438.56);
});

test("collecting a held deal releases that commission into ready to pay", () => {
  const month = julyMonth({
    collections: [...julyCollections(), { deal_id: "gutor", amount: 1139.25 }],
  });
  assert.equal(month.heldTotal, 3611.32);
  assert.equal(month.readyTotal, 7519.49);
  assert.equal(month.useDecision, false);
  assert.equal(month.deals.some(d => d.aca_id === "S00403"), false);
  assert.ok(month.people.every(p => p.readyToPay >= 0));
});

test("a month under RM 100,000 does not open a pool", () => {
  const calc = buildCommissionMonth({
    ...julyInput(),
    monthKey: "2026-01",
    linesMap: { total_cogs: { actuals: { Jan: 50000 }, hidden: false } },
    salesEntries: [{ id: 9, user_id: 2, client_name: "Small", amount: 1000, entry_date: "2026-01-15" }],
    deals: [],
    collections: [],
    costs: [],
    exclusions: [],
  });
  assert.equal(calc.qualified, false);
  assert.equal(calc.pool, 0);
  assert.equal(calc.readyTotal, 0);
});

test("July seed is used until the database has the rows, and it does not double", () => {
  const first = ensureJulySeed([], []);
  assert.equal(first.exclusions.length, 1);
  assert.equal(first.batches[0].status, "approved");
  assert.equal(first.batches[0].payroll_date, null);
  const again = ensureJulySeed(first.exclusions, first.batches);
  assert.equal(again.exclusions.length, 1);
  assert.equal(again.batches.length, 1);
  const turnedOff = ensureJulySeed([{ month_key: "2026-07", aca_id: "S00359", active: false }], first.batches);
  assert.equal(turnedOff.exclusions.length, 1);
  assert.equal(turnedOff.exclusions[0].active, false);
});

test("entity split and cent allocation sum exactly", () => {
  const split = entitySplit(3812.57, 281670.73, 237225.8);
  assert.equal(split.my, 2069.56);
  assert.equal(split.sg, 1743.01);
  const parts = allocateCents(100, [1, 1, 1]);
  assert.equal(parts.reduce((s, n) => s + n, 0), 100);
  const batch = julyApprovedBatch();
  for (const line of batch.lines) {
    assert.equal(Math.round((line.amount_my + line.amount_sg) * 100) / 100, line.amount);
  }
});

test("paid batches stay on the history and are not ready again", () => {
  const paid = julyApprovedBatch();
  paid.status = "paid";
  paid.payroll_date = "2026-08-25";
  const month = julyMonth({ batches: [paid] });
  assert.equal(month.people.find(p => p.key === "wilson").paid, 3812.57);
  assert.equal(month.people.find(p => p.key === "wilson").readyToPay, 0);
  assert.equal(month.people.find(p => p.key === "wilson").paidEvents[0].payrollDate, "2026-08-25");
});

test("commission migration is new tables plus the July seed, and does not touch live tables", () => {
  const sql = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
  const start = sql.indexOf("-- >>> COMMISSIONS_MIGRATION_START");
  const end = sql.indexOf("-- >>> COMMISSIONS_MIGRATION_END");
  assert.ok(start > 0 && end > start);
  const section = sql.slice(start, end);
  assert.match(section, /create table if not exists commission_exclusions/);
  assert.match(section, /create table if not exists commission_payout_batches/);
  assert.match(section, /create table if not exists commission_payout_lines/);
  assert.match(section, /create table if not exists commission_audit/);
  assert.match(section, /Paid commission batches are immutable/);
  assert.match(section, /Only an admin can mark a commission batch paid/);
  assert.match(section, /alter table commission_payout_batches\s+disable row level security/);
  assert.match(section, /S00359/);
  assert.match(section, /3812\.57/);
  assert.match(section, /status\s*=\s*'approved'|status = 'approved'/);
  assert.equal(/alter table users/i.test(section), false);
  assert.equal(/alter table sales_entries/i.test(section), false);
  assert.equal(/alter table budget_/i.test(section), false);
  assert.equal(/alter table traffic_/i.test(section), false);
  assert.equal(/instructure/i.test(section), false);
  assert.equal(/^\s*insert\s+into\s+traffic/im.test(section), false);
});

test("the commissions screen does not mention an Instructure review", () => {
  const src = ["commissions.jsx", "commissions-view.jsx", "commission-logic.js"]
    .map(f => fs.readFileSync(new URL(`./${f}`, import.meta.url), "utf8"))
    .join("\n");
  assert.equal(/under review/i.test(src), false);
  assert.equal(/duplicate/i.test(src), false);
});

test("year builder returns twelve months", () => {
  const year = buildCommissionYear(julyInput());
  assert.equal(year.months.length, 12);
  assert.equal(year.months[6].monthKey, "2026-07");
  assert.equal(year.months[6].pool, 11130.81);
});
