// Commission pool for King, Leon, Wilson, and Puteri.
// Justin is not in the pool. Pure functions — the page and the tests both use these.

import { BUDGET_MONTHS, budgetMonthKeyFromDate, computeBudgetRows, salesClosedByBudgetMonth } from "./budget-data.js";
import { ENTITIES, money } from "./traffic-board-logic.js";

export const QUALIFYING_NPBT = 100000;
export const POOL_RATE = 0.10;

// Payout order used on the July decision.
export const COMMISSION_PEOPLE = [
  { key: "wilson", name: "Wilson Goh", short: "Wilson" },
  { key: "leon", name: "Leon Lim", short: "Leon" },
  { key: "puteri", name: "Puteri Inez", short: "Puteri" },
  { key: "king", name: "King Quah", short: "King" },
];

// Who may open the Commissions screen. Edit this list to add or remove someone.
// A person matches on users.id or on email. Marking a batch paid is separate
// and stays limited to role admin.
export const COMMISSION_VIEWERS = [
  { id: 1, email: "king@saltycustoms.com" },
  { id: 2, email: "wilson@saltycustoms.com" },
  { id: 3, email: "puteri@saltycustoms.com" },
];

export function canViewCommissions(user) {
  if (!user) return false;
  const id = Number(user.id);
  const email = String(user.email || "").trim().toLowerCase();
  return COMMISSION_VIEWERS.some(viewer =>
    (Number.isFinite(id) && id === viewer.id) || (email && email === viewer.email)
  );
}

export function commissionsRequestedFromLocation(loc) {
  if (!loc) return false;
  const hash = String(loc.hash || "").replace(/^#/, "").split(/[?&]/)[0].trim().toLowerCase();
  let query = "";
  try {
    query = new URLSearchParams(loc.search || "").get("page") || "";
  } catch {
    query = "";
  }
  return hash === "commissions" || String(query).trim().toLowerCase() === "commissions";
}

export const JULY_2026_BATCH_ID = "20260715-0000-4000-8000-000000000001";

// King's approved July 2026 payout, after Justin's RM 7,856.18 Instructure
// sale left the Scoreboard. Budget NPBT is RM 151,881.29. Leaving Nokia's
// sales and cost out of that profit leaves RM 111,308.07, which still
// qualifies. The pool is RM 11,130.81. Person lines are King's cents:
// the live split gives Wilson and Puteri one cent the other way.
export const JULY_2026_DECISION = {
  monthKey: "2026-07",
  npbt: 151881.29,
  npbtExNokia: 111308.07,
  grossPool: 15188.13,
  pool: 11130.81,
  heldTotal: 3692.25,
  readyTotal: 7438.56,
  lines: {
    wilson: { full: 5705.00, held: 1892.43, ready: 3812.57 },
    leon: { full: 2214.89, held: 734.71, ready: 1480.18 },
    puteri: { full: 1819.57, held: 603.58, ready: 1215.99 },
    king: { full: 1391.35, held: 461.53, ready: 929.82 },
  },
};

export const JULY_2026_EXCLUSION = {
  id: "20260715-0000-4000-8000-000000000002",
  month_key: "2026-07",
  aca_id: "S00359",
  project_name: "Nokia (Via Eventually)",
  note: "Excluded until collected",
  active: true,
  persisted: false,
};

export function julyApprovedBatch() {
  const base = { my: 281670.73, sg: 237225.80 };
  const lines = COMMISSION_PEOPLE.map(p => {
    const ready = JULY_2026_DECISION.lines[p.key].ready;
    const split = entitySplit(ready, base.my, base.sg);
    return {
      person_key: p.key,
      person_name: p.name,
      amount: ready,
      amount_my: split.my,
      amount_sg: split.sg,
    };
  });
  return {
    id: JULY_2026_BATCH_ID,
    month_key: "2026-07",
    status: "approved",
    payroll_date: null,
    note: "July 2026 ready to pay, approved by King. Not yet marked paid.",
    persisted: false,
    lines,
  };
}

export function personKeyForUser(user) {
  const n = String(user?.name || "").toLowerCase();
  if (n.includes("king")) return "king";
  if (n.includes("leon")) return "leon";
  if (n.includes("wilson")) return "wilson";
  if (n.includes("puteri")) return "puteri";
  return null;
}

export function monthLabel(monthKey) {
  const [y, m] = String(monthKey || "").split("-");
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const name = names[Number(m) - 1];
  return name ? `${name} ${y}` : String(monthKey || "");
}

export function entityShort(id) {
  return ENTITIES.find(e => e.id === id)?.short || "—";
}

export function entitySplit(amount, myBase, sgBase) {
  const total = money(myBase) + money(sgBase);
  const amt = money(amount);
  if (!(amt > 0) || !(total > 0)) return { my: 0, sg: 0 };
  const my = money(amt * money(myBase) / total);
  return { my, sg: money(amt - my) };
}

// Largest-remainder allocation so the cents sum to money(total).
export function allocateCents(total, weights) {
  const t = Math.round((money(total) + Number.EPSILON) * 100);
  const w = (weights || []).map(x => Math.max(0, Number(x) || 0));
  if (t <= 0 || w.length === 0) return w.map(() => 0);
  const sum = w.reduce((s, x) => s + x, 0);
  if (!(sum > 0)) return w.map(() => 0);
  const raw = w.map(x => (t * x) / sum);
  const floors = raw.map(x => Math.floor(x + 1e-9));
  let leftover = t - floors.reduce((s, x) => s + x, 0);
  const order = raw
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));
  const out = floors.slice();
  let k = 0;
  while (leftover > 0 && order.length) {
    out[order[k % order.length].i] += 1;
    leftover -= 1;
    k += 1;
    if (k > t + order.length) break;
  }
  return out.map(c => c / 100);
}

function normAca(v) {
  const t = String(v || "").trim().toLowerCase();
  return t || null;
}

function tokens(s) {
  return String(s || "").toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 4);
}

function overlaps(a, b) {
  const tb = new Set(tokens(b));
  return tokens(a).some(t => tb.has(t));
}

function usersById(users) {
  const map = {};
  for (const u of users || []) map[String(u.id)] = u;
  return map;
}

function personIdMap(users) {
  const map = {};
  for (const u of users || []) {
    const key = personKeyForUser(u);
    if (key && map[key] == null) map[key] = u.id;
  }
  return map;
}

export function uncollectedCommission(amount, collected, cogs) {
  const amt = money(amount);
  const col = money(collected);
  const outstanding = money(Math.max(0, amt - col));
  const gp = money(amt - money(cogs));
  if (!(amt > 0) || !(outstanding > 0)) return { outstanding, gp, commission: 0 };
  const uncollectedGp = gp * (outstanding / amt);
  const commission = money(Math.max(0, uncollectedGp) * POOL_RATE);
  return { outstanding, gp, commission };
}

function isExclusionActive(row) {
  return row && row.active !== false;
}

export function dealIsExcluded(deal, exclusions, monthKey) {
  const aca = normAca(deal?.aca_id);
  return (exclusions || []).some(e => {
    if (!isExclusionActive(e) || e.month_key !== monthKey) return false;
    if (e.deal_id && deal?.id && String(e.deal_id) === String(deal.id)) return true;
    const exAca = normAca(e.aca_id);
    return !!(aca && exAca && aca === exAca);
  });
}

function splitPeople(pool, salesByKey) {
  const sales = COMMISSION_PEOPLE.map(p => Math.max(0, money(salesByKey[p.key] || 0)));
  const poolC = Math.round((money(pool) + Number.EPSILON) * 100);
  const evenC = Math.round(poolC / 2);
  const proC = poolC - evenC;
  const evenWeights = COMMISSION_PEOPLE.map(() => 1);
  const proWeights = sales.some(s => s > 0) ? sales : evenWeights;
  const even = allocateCents(evenC / 100, evenWeights);
  const pro = allocateCents(proC / 100, proWeights);
  return COMMISSION_PEOPLE.map((p, i) => ({
    key: p.key,
    name: p.name,
    short: p.short,
    sales: sales[i],
    even: even[i],
    pro: pro[i],
    full: money(even[i] + pro[i]),
  }));
}

function sumMap(rows, idKey = "deal_id") {
  const map = {};
  for (const row of rows || []) {
    const id = row[idKey];
    if (!id) continue;
    map[id] = money((map[id] || 0) + money(row.amount));
  }
  return map;
}

function tagEntries(entries, users) {
  const byId = usersById(users);
  return (entries || []).map(e => ({
    ...e,
    person_key: e.person_key || personKeyForUser(byId[String(e.user_id)] || { name: e.person_name }),
  }));
}

function salesByPerson(entries, monthKey) {
  const totals = Object.fromEntries(COMMISSION_PEOPLE.map(p => [p.key, 0]));
  for (const e of entries) {
    if (!e.person_key || budgetMonthKeyFromDate(e.entry_date) !== monthKey) continue;
    totals[e.person_key] = money(totals[e.person_key] + money(e.amount));
  }
  return totals;
}

function removeExcludedSales(entries, monthKey, excludedDeals) {
  const removed = Object.fromEntries(COMMISSION_PEOPLE.map(p => [p.key, 0]));
  const used = new Set();
  const monthEntries = entries.filter(e => budgetMonthKeyFromDate(e.entry_date) === monthKey);
  for (const deal of excludedDeals) {
    let entry = null;
    if (deal.sales_entry_id != null) {
      entry = monthEntries.find(e => String(e.id) === String(deal.sales_entry_id) && !used.has(e.id));
    }
    if (!entry) {
      const owner = personKeyForUser({ name: deal.ac_in_charge || "" }) || personKeyForUser({ name: deal.lead_owner || "" });
      const sameAmount = monthEntries.filter(e => !used.has(e.id) && money(e.amount) === money(deal.amount_myr));
      const owned = owner ? sameAmount.filter(e => e.person_key === owner) : [];
      const pool = owned.length ? owned : sameAmount.filter(e => e.person_key);
      entry = pool.find(e => overlaps(e.client_name, deal.project_name)) || pool[0] || null;
    }
    if (!entry?.person_key) continue;
    used.add(entry.id);
    removed[entry.person_key] = money(removed[entry.person_key] + money(entry.amount));
  }
  return removed;
}

export function npbtForMonth(linesMap, salesEntries, year, monthKey) {
  const salesByMonth = salesClosedByBudgetMonth(salesEntries, year);
  const rows = computeBudgetRows(linesMap, salesByMonth, false);
  const net = rows.find(r => r.key === "net_profit");
  const name = BUDGET_MONTHS[Number(String(monthKey).slice(5, 7)) - 1];
  return net && name ? Number(net.actuals[name]) || 0 : 0;
}

export function buildCommissionMonth({
  monthKey,
  year,
  linesMap,
  salesEntries,
  deals,
  collections,
  costs,
  exclusions,
  users,
}) {
  const npbt = npbtForMonth(linesMap, salesEntries, year, monthKey);
  const qualified = npbt >= QUALIFYING_NPBT;
  const grossPool = qualified ? money(npbt * POOL_RATE) : 0;
  const collectedBy = sumMap(collections);
  const costBy = sumMap(costs);
  const ids = personIdMap(users);
  const tagged = tagEntries(salesEntries, users);

  const openExcluded = [];
  const dealRows = [];
  let myBase = 0;
  let sgBase = 0;

  for (const deal of deals || []) {
    if (budgetMonthKeyFromDate(deal.deal_close_date) !== monthKey && String(deal.deal_close_date || "").slice(0, 7) !== monthKey) continue;
    const amount = money(deal.amount_myr);
    const collected = money(collectedBy[deal.id] || 0);
    const cogs = money(costBy[deal.id] || 0);
    const econ = uncollectedCommission(amount, collected, cogs);
    const excluded = dealIsExcluded(deal, exclusions, monthKey);
    const open = econ.outstanding > 0;
    let status = null;
    if (excluded && open) status = "pending";
    else if (qualified && !excluded && open && econ.commission > 0) status = "held";
    const commission = status === "pending" ? (qualified ? econ.commission : 0) : (status === "held" ? econ.commission : 0);
    const inEntityBase = !(excluded && open);
    if (inEntityBase) {
      if (deal.entity === "saltyskins_my") myBase = money(myBase + amount);
      else if (deal.entity === "saltycustoms_sg") sgBase = money(sgBase + amount);
    }
    if (status) {
      const row = {
        id: deal.id,
        aca_id: deal.aca_id || null,
        project_name: deal.project_name,
        entity: deal.entity,
        entityShort: entityShort(deal.entity),
        amount,
        collected,
        outstanding: econ.outstanding,
        cogs,
        gp: econ.gp,
        commission,
        status,
        statusLabel: status === "pending" ? "Pending — excluded until collected" : "Held",
        sales_entry_id: deal.sales_entry_id || null,
        ac_in_charge: deal.ac_in_charge || null,
        lead_owner: deal.lead_owner || null,
        amount_myr: amount,
      };
      dealRows.push(row);
      if (status === "pending") openExcluded.push(deal);
    }
  }

  let pendingTotal = money(dealRows.filter(d => d.status === "pending").reduce((s, d) => s + d.commission, 0));
  let pool = money(Math.max(0, grossPool - pendingTotal));
  let heldRows = dealRows.filter(d => d.status === "held");
  let heldTotal = money(heldRows.reduce((s, d) => s + d.commission, 0));
  if (heldTotal > pool && heldTotal > 0) {
    const factor = pool / heldTotal;
    for (const row of heldRows) row.commission = money(row.commission * factor);
    const scaled = money(heldRows.reduce((s, d) => s + d.commission, 0));
    const drift = money(pool - scaled);
    if (heldRows.length && drift !== 0) heldRows[0].commission = money(heldRows[0].commission + drift);
    heldTotal = pool;
  }
  const readyTotal = money(Math.max(0, pool - heldTotal));

  const grossSales = salesByPerson(tagged, monthKey);
  const removed = removeExcludedSales(tagged, monthKey, openExcluded);
  const netSales = Object.fromEntries(COMMISSION_PEOPLE.map(p => [p.key, money(Math.max(0, grossSales[p.key] - removed[p.key]))]));

  const fullPeople = qualified ? splitPeople(pool, netSales) : splitPeople(0, netSales);
  const heldShares = qualified ? allocateCents(heldTotal, fullPeople.map(p => p.full)) : fullPeople.map(() => 0);
  const pendingWeights = COMMISSION_PEOPLE.map(p => grossSales[p.key]);
  const pendingShares = qualified
    ? allocateCents(pendingTotal, pendingWeights.some(w => w > 0) ? pendingWeights : pendingWeights.map(() => 1))
    : COMMISSION_PEOPLE.map(() => 0);

  const people = fullPeople.map((p, i) => {
    const held = heldShares[i] || 0;
    const ready = money(Math.max(0, p.full - held));
    return {
      ...p,
      userId: ids[p.key] ?? null,
      grossSales: grossSales[p.key],
      held,
      ready,
      pending: pendingShares[i] || 0,
    };
  });

  dealRows.sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    return b.amount - a.amount;
  });

  return {
    monthKey,
    npbt,
    qualified,
    grossPool,
    pendingTotal,
    pool,
    heldTotal,
    readyTotal,
    entityBase: { my: myBase, sg: sgBase },
    people,
    deals: dealRows,
    useDecision: false,
  };
}

function paidByPerson(batches) {
  const paid = {};
  const events = {};
  for (const p of COMMISSION_PEOPLE) {
    paid[p.key] = 0;
    events[p.key] = [];
  }
  for (const batch of batches || []) {
    if (batch.status !== "paid") continue;
    for (const line of batch.lines || []) {
      if (!paid[line.person_key] && paid[line.person_key] !== 0) continue;
      paid[line.person_key] = money(paid[line.person_key] + money(line.amount));
      events[line.person_key].push({
        payrollDate: batch.payroll_date,
        amount: money(line.amount),
        amountMy: money(line.amount_my),
        amountSg: money(line.amount_sg),
        batchId: batch.id,
      });
    }
  }
  return { paid, events };
}

export function composeCommissionMonth(calc, batches) {
  const monthBatches = (batches || []).filter(b => b.month_key === calc.monthKey);
  const { paid, events } = paidByPerson(monthBatches);
  const decision = calc.monthKey === JULY_2026_DECISION.monthKey
    && calc.qualified
    && Math.abs(money(calc.pool) - JULY_2026_DECISION.pool) < 0.02
    && Math.abs(money(calc.heldTotal) - JULY_2026_DECISION.heldTotal) < 0.02
    ? JULY_2026_DECISION
    : null;

  const people = calc.people.map(p => {
    const line = decision?.lines[p.key];
    const full = line ? line.full : p.full;
    const held = line ? line.held : p.held;
    const schemeReady = line ? line.ready : p.ready;
    const already = paid[p.key] || 0;
    const readyToPay = money(Math.max(0, schemeReady - already));
    const split = entitySplit(readyToPay, calc.entityBase.my, calc.entityBase.sg);
    const paidSplit = (events[p.key] || []).reduce((s, e) => ({
      my: money(s.my + e.amountMy),
      sg: money(s.sg + e.amountSg),
    }), { my: 0, sg: 0 });
    return {
      ...p,
      full,
      held,
      ready: schemeReady,
      paid: already,
      readyToPay,
      readyMy: split.my,
      readySg: split.sg,
      paidMy: paidSplit.my,
      paidSg: paidSplit.sg,
      paidEvents: events[p.key] || [],
    };
  });

  const approvedBatch = monthBatches.find(b => b.status === "approved") || null;
  return {
    ...calc,
    npbt: decision ? decision.npbt : calc.npbt,
    npbtExNokia: decision ? decision.npbtExNokia : null,
    grossPool: decision ? decision.grossPool : calc.grossPool,
    pool: decision ? decision.pool : calc.pool,
    readyTotal: decision ? decision.readyTotal : calc.readyTotal,
    people,
    useDecision: !!decision,
    approvedBatch,
    paidBatches: monthBatches.filter(b => b.status === "paid"),
    readyPayroll: money(people.reduce((s, p) => s + p.readyToPay, 0)),
    paidTotal: money(people.reduce((s, p) => s + p.paid, 0)),
  };
}

export function buildCommissionYear(input) {
  const year = input.year;
  const months = BUDGET_MONTHS.map((_, i) => {
    const monthKey = `${year}-${String(i + 1).padStart(2, "0")}`;
    const calc = buildCommissionMonth({ ...input, year, monthKey });
    return composeCommissionMonth(calc, input.batches);
  });
  return { year, months };
}

export function defaultCommissionMonth(months, today = new Date()) {
  const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const qualifying = (months || []).filter(m => m.qualified && m.pool > 0);
  if (qualifying.length) return qualifying[qualifying.length - 1].monthKey;
  if ((months || []).some(m => m.monthKey === key)) return key;
  return months?.[0]?.monthKey || key;
}

export function ensureJulySeed(exclusions, batches) {
  const ex = [...(exclusions || [])];
  const hasNokia = ex.some(e => e.month_key === "2026-07" && normAca(e.aca_id) === "s00359");
  if (!hasNokia) ex.push({ ...JULY_2026_EXCLUSION });
  const rows = [...(batches || [])];
  const hasJuly = rows.some(b => b.month_key === "2026-07");
  if (!hasJuly) rows.push(julyApprovedBatch());
  return { exclusions: ex, batches: rows };
}
