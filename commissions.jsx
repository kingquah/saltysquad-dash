import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase.js";
import schemaSql from "./schema.sql?raw";
import { CommissionsView } from "./commissions-view.jsx";
import { isMissingTableError } from "./traffic-board-logic.js";
import {
  buildCommissionYear,
  defaultCommissionMonth,
  ensureJulySeed,
} from "./commission-logic.js";

export function commissionMigrationSql(sql = schemaSql) {
  const start = sql.indexOf("-- >>> COMMISSIONS_MIGRATION_START");
  const end = sql.indexOf("-- >>> COMMISSIONS_MIGRATION_END");
  if (start < 0 || end < 0) return "";
  const bodyStart = sql.indexOf("\n", start) + 1;
  return sql.slice(bodyStart, end).trim();
}

async function fetchAll(makeQuery) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    const { data, error } = await makeQuery().range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return { data: all, error: null };
}

function linesMapFrom(rows) {
  const map = {};
  for (const row of rows || []) {
    map[row.line_key] = {
      monthly_budget: Number(row.monthly_budget) || 0,
      actuals: row.actuals || {},
      hidden: !!row.hidden,
      is_custom: !!row.is_custom,
      label: row.label,
      section: row.section,
    };
  }
  return map;
}

function packBatches(batchRows, lineRows) {
  return (batchRows || []).map(b => ({
    id: b.id,
    month_key: b.month_key,
    status: b.status,
    payroll_date: b.payroll_date,
    note: b.note,
    persisted: true,
    lines: (lineRows || []).filter(l => l.batch_id === b.id).map(l => ({
      person_key: l.person_key,
      person_name: l.person_name,
      user_id: l.user_id,
      amount: Number(l.amount),
      amount_my: Number(l.amount_my),
      amount_sg: Number(l.amount_sg),
    })),
  }));
}

export function CommissionsPage({ currentUser, users, canMarkPaid }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [monthKey, setMonthKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tablesReady, setTablesReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [linesMap, setLinesMap] = useState({});
  const [salesEntries, setSalesEntries] = useState([]);
  const [deals, setDeals] = useState([]);
  const [collections, setCollections] = useState([]);
  const [costs, setCosts] = useState([]);
  const [exclusions, setExclusions] = useState([]);
  const [batches, setBatches] = useState([]);
  const [audit, setAudit] = useState([]);

  async function fetchYear(forYear) {
    const start = `${forYear}-01-01`;
    const end = `${forYear + 1}-01-01`;
    const [lnRes, salesRes, dealsRes, colRes, costRes, exRes, batchRes, lineRes, auditRes] = await Promise.all([
      supabase.from("budget_lines").select("line_key, monthly_budget, actuals, hidden, is_custom, label, section").eq("year", forYear),
      fetchAll(() => supabase.from("sales_entries").select("id, user_id, client_name, amount, entry_date").eq("category", "sales_closed").gte("entry_date", start).lt("entry_date", end).order("id")),
      fetchAll(() => supabase.from("traffic_deals").select("id, aca_id, project_name, entity, amount_myr, deal_close_date, sales_entry_id, ac_in_charge, lead_owner").gte("deal_close_date", start).lt("deal_close_date", end).order("deal_close_date")),
      fetchAll(() => supabase.from("traffic_collections").select("deal_id, amount").order("id")),
      fetchAll(() => supabase.from("traffic_costs").select("deal_id, amount").order("id")),
      supabase.from("commission_exclusions").select("*"),
      supabase.from("commission_payout_batches").select("*"),
      supabase.from("commission_payout_lines").select("*"),
      supabase.from("commission_audit").select("*").order("created_at", { ascending: false }).limit(80),
    ]);

    const hard = [lnRes.error, salesRes.error, dealsRes.error, colRes.error, costRes.error].filter(Boolean);
    const missing = [exRes.error, batchRes.error, lineRes.error, auditRes.error].some(isMissingTableError);
    const dbExclusions = missing ? [] : (exRes.data || []).map(row => ({ ...row, persisted: true }));
    const dbBatches = missing ? [] : packBatches(batchRes.data, lineRes.data);
    const seeded = ensureJulySeed(dbExclusions, dbBatches);
    return {
      loadError: hard.length ? (hard[0].message || "Could not load commissions.") : "",
      tablesReady: !missing,
      linesMap: linesMapFrom(lnRes.data),
      salesEntries: salesRes.data || [],
      deals: dealsRes.data || [],
      collections: colRes.data || [],
      costs: costRes.data || [],
      exclusions: seeded.exclusions,
      batches: seeded.batches,
      audit: missing ? [] : (auditRes.data || []),
    };
  }

  function applyPayload(payload) {
    setLoadError(payload.loadError);
    setTablesReady(payload.tablesReady);
    setLinesMap(payload.linesMap);
    setSalesEntries(payload.salesEntries);
    setDeals(payload.deals);
    setCollections(payload.collections);
    setCosts(payload.costs);
    setExclusions(payload.exclusions);
    setBatches(payload.batches);
    setAudit(payload.audit);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const payload = await fetchYear(year);
      if (cancelled) return;
      applyPayload(payload);
      setMonthKey(prev => (prev && prev.startsWith(String(year)) ? prev : null));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const model = useMemo(() => buildCommissionYear({
    year,
    linesMap,
    salesEntries,
    deals,
    collections,
    costs,
    exclusions,
    batches,
    users,
  }), [year, linesMap, salesEntries, deals, collections, costs, exclusions, batches, users]);

  const activeMonth = monthKey && model.months.some(m => m.monthKey === monthKey)
    ? monthKey
    : defaultCommissionMonth(model.months, new Date());

  async function refresh() {
    setSaving(true);
    applyPayload(await fetchYear(year));
    setSaving(false);
  }

  async function onMarkPaid(payrollDate) {
    setActionError("");
    if (!canMarkPaid || currentUser?.role !== "admin") {
      setActionError("Only an admin can mark a batch paid.");
      return;
    }
    if (!tablesReady) {
      setActionError("Run the commissions SQL in Supabase first. Nothing was marked paid.");
      return;
    }
    const month = model.months.find(m => m.monthKey === activeMonth);
    if (!month || !(month.readyPayroll > 0)) {
      setActionError("Nothing is ready to pay.");
      return;
    }
    setSaving(true);
    let batch = month.approvedBatch && month.approvedBatch.persisted ? month.approvedBatch : null;
    if (!batch) {
      const inserted = await supabase.from("commission_payout_batches").insert({
        month_key: month.monthKey,
        status: "approved",
        note: `${month.monthKey} ready to pay`,
        approved_by: currentUser.id,
        approved_by_name: currentUser.name,
        approved_at: new Date().toISOString(),
      }).select().single();
      if (inserted.error) {
        setSaving(false);
        setActionError(inserted.error.message || "Could not open the payout batch.");
        return;
      }
      batch = { ...inserted.data, persisted: true, lines: [] };
    }

    for (const person of month.people) {
      const up = await supabase.from("commission_payout_lines").upsert({
        batch_id: batch.id,
        user_id: person.userId,
        person_key: person.key,
        person_name: person.name,
        amount: person.readyToPay,
        amount_my: person.readyMy,
        amount_sg: person.readySg,
      }, { onConflict: "batch_id,person_key" });
      if (up.error) {
        setSaving(false);
        setActionError(up.error.message || "Could not save the payout lines.");
        return;
      }
    }

    const paid = await supabase.from("commission_payout_batches").update({
      status: "paid",
      payroll_date: payrollDate,
      paid_by: currentUser.id,
      paid_by_name: currentUser.name,
      paid_at: new Date().toISOString(),
    }).eq("id", batch.id).eq("status", "approved").select();
    if (paid.error || !paid.data?.length) {
      setSaving(false);
      setActionError(paid.error?.message || "This batch is already paid.");
      return;
    }
    setSaving(false);
    await refresh();
  }

  function findExclusion(deal) {
    const aca = String(deal.aca_id || "").trim().toLowerCase();
    return exclusions.find(e => e.active !== false && e.month_key === activeMonth && (
      (e.deal_id && String(e.deal_id) === String(deal.id)) ||
      (aca && String(e.aca_id || "").trim().toLowerCase() === aca)
    ));
  }

  async function onExclude(deal) {
    setActionError("");
    if (!canMarkPaid) return;
    if (!tablesReady) {
      setActionError("Run the commissions SQL in Supabase first. The deal was not excluded.");
      return;
    }
    setSaving(true);
    const ins = await supabase.from("commission_exclusions").insert({
      month_key: activeMonth,
      deal_id: deal.id,
      aca_id: deal.aca_id,
      project_name: deal.project_name,
      note: "Excluded until collected",
      active: true,
      created_by: currentUser.id,
      created_by_name: currentUser.name,
    }).select().single();
    if (ins.error) {
      setSaving(false);
      setActionError(ins.error.message || "Could not exclude that deal.");
      return;
    }
    await supabase.from("commission_audit").insert({
      month_key: activeMonth,
      action: "excluded",
      new_value: `${deal.project_name || ""} ${deal.aca_id || ""}`.trim(),
      user_id: currentUser.id,
      user_name: currentUser.name,
    });
    setSaving(false);
    await refresh();
  }

  async function onInclude(deal) {
    setActionError("");
    if (!canMarkPaid) return;
    const row = findExclusion(deal);
    if (!tablesReady || !row?.persisted) {
      setActionError("Run the commissions SQL in Supabase first. Nothing was changed.");
      return;
    }
    setSaving(true);
    const upd = await supabase.from("commission_exclusions").update({ active: false }).eq("id", row.id);
    if (upd.error) {
      setSaving(false);
      setActionError(upd.error.message || "Could not put that deal back.");
      return;
    }
    await supabase.from("commission_audit").insert({
      month_key: activeMonth,
      action: "included",
      new_value: `${deal.project_name || ""} ${deal.aca_id || ""}`.trim(),
      user_id: currentUser.id,
      user_name: currentUser.name,
    });
    setSaving(false);
    await refresh();
  }

  if (loading) return <div style={{ color: "#9a8a7a", padding: 24 }}>Loading commissions…</div>;

  const years = Array.from(new Set([2026, now.getFullYear(), year])).sort();

  return (
    <CommissionsView
      year={year}
      years={years}
      onYear={y => { setMonthKey(null); setYear(y); }}
      months={model.months}
      monthKey={activeMonth}
      onMonth={setMonthKey}
      canMarkPaid={!!canMarkPaid}
      tablesReady={tablesReady}
      migrationSql={commissionMigrationSql()}
      audit={audit}
      saving={saving}
      loadError={loadError}
      actionError={actionError}
      onMarkPaid={onMarkPaid}
      onExclude={onExclude}
      onInclude={onInclude}
    />
  );
}
