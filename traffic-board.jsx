import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";
import schemaSql from "./schema.sql?raw";
import opsMd from "./docs/TRAFFIC-BOARD-OPS.md?raw";
import { TrafficBoardView } from "./traffic-board-view.jsx";
import {
  blankToNull,
  canLockCosts,
  collectionSnapshot,
  costSnapshot,
  dealAuditDiff,
  dealSnapshot,
  deriveDeal,
  filterDeals,
  formatRM,
  friendlyWriteError,
  gpText,
  isMissingTableError,
  money,
  monthKeyFromDate,
  summarize,
  todayISO,
} from "./traffic-board-logic.js";

export function trafficMigrationSql(sql = schemaSql) {
  const start = sql.indexOf("-- >>> TRAFFIC_BOARD_MIGRATION_START");
  const end = sql.indexOf("-- >>> TRAFFIC_BOARD_MIGRATION_END");
  if (start < 0 || end < 0) return "";
  const bodyStart = sql.indexOf("\n", start) + 1;
  return sql.slice(bodyStart, end).trim();
}

async function readBoard() {
  const [dealsRes, colRes, costRes, auditRes] = await Promise.all([
    supabase.from("traffic_deals").select("*").order("deal_close_date", { ascending: false }),
    supabase.from("traffic_collections").select("*").order("collected_at", { ascending: false }),
    supabase.from("traffic_costs").select("*").order("cost_date", { ascending: false }),
    supabase.from("traffic_audit").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  const errors = [dealsRes.error, colRes.error, costRes.error, auditRes.error].filter(Boolean);
  return {
    missing: errors.some(isMissingTableError),
    error: errors.find(e => !isMissingTableError(e)) || null,
    deals: dealsRes.data || [],
    collections: colRes.data || [],
    costs: costRes.data || [],
    audit: auditRes.data || [],
  };
}

export function TrafficBoardPage({ currentUser, users, canWrite }) {
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deals, setDeals] = useState([]);
  const [collections, setCollections] = useState([]);
  const [costs, setCosts] = useState([]);
  const [audit, setAudit] = useState([]);
  const [salesOptions, setSalesOptions] = useState([]);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    const board = await readBoard();
    if (board.missing) { setMissing(true); setLoading(false); return; }
    if (board.error) setLoadError(board.error.message || "Could not load the board.");
    else setLoadError("");
    setDeals(board.deals);
    setCollections(board.collections);
    setCosts(board.costs);
    setAudit(board.audit);
    setMissing(false);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      const { data } = await supabase
        .from("sales_entries")
        .select("id, client_name, amount, entry_date, category")
        .eq("category", "sales_closed")
        .order("entry_date", { ascending: false })
        .limit(400);
      if (!cancelled && data) setSalesOptions(data);
    })();
    return () => { cancelled = true; };
    // refresh closes over the latest writer only for audit, which is not used here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function writeAudit(deal, rows) {
    if (!rows.length) return;
    const payload = rows.map(r => ({
      deal_id: deal?.id ?? null,
      project_name: deal?.project_name ?? null,
      aca_id: deal?.aca_id ?? null,
      field: r.field,
      old_value: r.old_value ?? null,
      new_value: r.new_value ?? null,
      user_id: currentUser?.id ?? null,
      user_name: currentUser?.name ?? null,
    }));
    const { error } = await supabase.from("traffic_audit").insert(payload);
    if (error) {
      console.error("[traffic audit]", error);
      window.alert("The change was saved, but the audit trail did not record it.\n\n" + error.message);
    }
  }

  async function onCreateDeal(input) {
    setSaving(true);
    const { data, error } = await supabase.from("traffic_deals").insert({
      ...input,
      created_by: currentUser?.id ?? null,
      created_by_name: currentUser?.name ?? null,
      updated_by: currentUser?.id ?? null,
      updated_by_name: currentUser?.name ?? null,
    }).select().single();
    setSaving(false);
    if (error) return { errors: [friendlyWriteError(error)] };
    await writeAudit(data, [{ field: "deal", old_value: null, new_value: dealSnapshot(data) }]);
    await refresh();
    return { errors: [] };
  }

  async function onUpdateDeal(deal, input) {
    setSaving(true);
    const { data, error } = await supabase.from("traffic_deals").update({
      ...input,
      updated_by: currentUser?.id ?? null,
      updated_by_name: currentUser?.name ?? null,
    }).eq("id", deal.id).select().single();
    setSaving(false);
    if (error) return { errors: [friendlyWriteError(error)] };
    await writeAudit(data, dealAuditDiff(deal, data));
    await refresh();
    return { errors: [] };
  }

  async function onDeleteDeal(deal) {
    setSaving(true);
    const { error } = await supabase.from("traffic_deals").delete().eq("id", deal.id);
    setSaving(false);
    if (error) { window.alert(friendlyWriteError(error)); return; }
    await writeAudit(deal, [{ field: "deal", old_value: dealSnapshot(deal), new_value: "deleted" }]);
    await refresh();
  }

  async function onSaveCollection(deal, draft) {
    setSaving(true);
    const note = blankToNull(draft.note);
    let data, error;
    if (draft.editingId) {
      ({ data, error } = await supabase.from("traffic_collections").update({
        collected_at: draft.collected_at,
        amount: money(draft.amount),
        note,
      }).eq("id", draft.editingId).select().single());
    } else {
      ({ data, error } = await supabase.from("traffic_collections").insert({
        deal_id: deal.id,
        collected_at: draft.collected_at,
        amount: money(draft.amount),
        note,
        recorded_by: currentUser?.id ?? null,
        recorded_by_name: currentUser?.name ?? null,
      }).select().single());
    }
    setSaving(false);
    if (error) return { errors: [friendlyWriteError(error)] };
    const prev = (deal.collections || []).find(c => c.id === draft.editingId);
    await writeAudit(deal, [{
      field: "collection",
      old_value: prev ? collectionSnapshot(prev) : null,
      new_value: collectionSnapshot(data),
    }]);
    await refresh();
    return { errors: [] };
  }

  async function onDeleteCollection(deal, row) {
    if (!window.confirm("Remove this collection?")) return;
    setSaving(true);
    const { error } = await supabase.from("traffic_collections").delete().eq("id", row.id);
    setSaving(false);
    if (error) { window.alert(friendlyWriteError(error)); return; }
    await writeAudit(deal, [{ field: "collection", old_value: collectionSnapshot(row), new_value: null }]);
    await refresh();
  }

  async function onSaveCost(deal, draft) {
    if (deal.costs_locked) return { errors: ["Costs are locked. Unlock the job before changing costs."] };
    setSaving(true);
    const note = blankToNull(draft.note);
    let data, error;
    if (draft.editingId) {
      ({ data, error } = await supabase.from("traffic_costs").update({
        cost_date: draft.cost_date,
        cost_type: draft.cost_type,
        amount: money(draft.amount),
        note,
      }).eq("id", draft.editingId).select().single());
    } else {
      ({ data, error } = await supabase.from("traffic_costs").insert({
        deal_id: deal.id,
        cost_date: draft.cost_date,
        cost_type: draft.cost_type,
        amount: money(draft.amount),
        note,
        recorded_by: currentUser?.id ?? null,
        recorded_by_name: currentUser?.name ?? null,
      }).select().single());
    }
    setSaving(false);
    if (error) return { errors: [friendlyWriteError(error)] };
    const prev = (deal.costs || []).find(c => c.id === draft.editingId);
    await writeAudit(deal, [{
      field: "cost",
      old_value: prev ? costSnapshot(prev) : null,
      new_value: costSnapshot(data),
    }]);
    await refresh();
    return { errors: [] };
  }

  async function onDeleteCost(deal, row) {
    if (deal.costs_locked) { window.alert("Costs are locked. Unlock the job before changing costs."); return; }
    if (!window.confirm("Remove this cost?")) return;
    setSaving(true);
    const { error } = await supabase.from("traffic_costs").delete().eq("id", row.id);
    setSaving(false);
    if (error) { window.alert(friendlyWriteError(error)); return; }
    await writeAudit(deal, [{ field: "cost", old_value: costSnapshot(row), new_value: null }]);
    await refresh();
  }

  async function onSetLocked(deal, locked) {
    if (locked && !canLockCosts(deal.costs)) {
      return { errors: ["Enter at least one cost before locking. A blank cost is not a final margin."] };
    }
    setSaving(true);
    const { error } = await supabase.from("traffic_deals").update({
      costs_locked: locked,
      updated_by: currentUser?.id ?? null,
      updated_by_name: currentUser?.name ?? null,
    }).eq("id", deal.id);
    setSaving(false);
    if (error) return { errors: [friendlyWriteError(error)] };
    await writeAudit(deal, [{
      field: "costs_locked",
      old_value: deal.costs_locked ? "locked" : "unlocked",
      new_value: locked ? "locked" : "unlocked",
    }]);
    await refresh();
    return { errors: [] };
  }

  if (loading) return <div style={{ color: "#9a8a7a", padding: 24 }}>Loading Traffic Board…</div>;

  if (missing) {
    const sql = trafficMigrationSql();
    return (
      <div style={{ background: "#fff", borderRadius: 16, padding: "28px 30px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", maxWidth: 760 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "#3a2a1a", marginTop: 0 }}>🚦 One-time setup</h2>
        <p style={{ color: "#7a6a5a", fontSize: 14, lineHeight: 1.6 }}>
          The Traffic Board needs its tables. In <strong>Supabase → SQL Editor</strong>, run the block below once, then reload. It only creates new tables. It does not change existing tables and it does not insert money.
        </p>
        <pre style={{ background: "#faf7f3", border: "1px solid #ece3da", borderRadius: 8, padding: "12px 14px", fontSize: 11.5, overflowX: "auto", whiteSpace: "pre", color: "#5a4a3a" }}>{sql}</pre>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(sql); setCopied(true); } catch { setCopied(false); } }} style={{ background: "#c4704a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}>
          {copied ? "Copied" : "Copy SQL"}
        </button>
      </div>
    );
  }

  return (
    <div>
      {loadError && <div style={{ background: "#fde8e8", color: "#a32020", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>{loadError}</div>}
      <TrafficBoardView
        canWrite={!!canWrite}
        users={users}
        deals={deals}
        collections={collections}
        costs={costs}
        audit={audit}
        salesOptions={salesOptions}
        saving={saving}
        opsMd={opsMd}
        onCreateDeal={onCreateDeal}
        onUpdateDeal={onUpdateDeal}
        onDeleteDeal={onDeleteDeal}
        onSaveCollection={onSaveCollection}
        onDeleteCollection={onDeleteCollection}
        onSaveCost={onSaveCost}
        onDeleteCost={onDeleteCost}
        onSetLocked={onSetLocked}
      />
    </div>
  );
}

export function LiveCashIndicator({ onOpen }) {
  const [state, setState] = useState({ loading: true, missing: false, error: "", summary: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const board = await readBoard();
      if (cancelled) return;
      if (board.missing) { setState({ loading: false, missing: true, error: "", summary: null }); return; }
      if (board.error) { setState({ loading: false, missing: false, error: "Couldn't load cash totals.", summary: null }); return; }
      const today = todayISO();
      const month = monthKeyFromDate();
      const derived = board.deals.map(d => deriveDeal(d, board.collections, board.costs, today));
      const summary = summarize(filterDeals(derived, { month }));
      setState({ loading: false, missing: false, error: "", summary });
    })();
    return () => { cancelled = true; };
  }, []);

  const box = { background: "#fff", borderRadius: 16, padding: "18px 20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", borderLeft: "4px solid #c4704a", marginBottom: 22, cursor: onOpen ? "pointer" : "default" };

  if (state.loading) {
    return <div style={box}><div style={{ fontSize: 12, fontWeight: 700, color: "#9a8a7a", letterSpacing: 0.4, textTransform: "uppercase" }}>Live cash</div><div style={{ color: "#9a8a7a", marginTop: 6, fontSize: 13 }}>Loading recorded collections…</div></div>;
  }

  return (
    <div style={box} onClick={onOpen} role={onOpen ? "button" : undefined}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8a7a", letterSpacing: 0.4, textTransform: "uppercase" }}>Live cash · this month’s closed deals</div>
        {onOpen && <span style={{ fontSize: 12, fontWeight: 700, color: "#c4704a" }}>Open Traffic Board</span>}
      </div>
      {state.missing && <p style={{ margin: "8px 0 0", color: "#7a6a5a", fontSize: 13 }}>Traffic Board isn’t set up yet. Open it for the one-time SQL.</p>}
      {state.error && <p style={{ margin: "8px 0 0", color: "#a32020", fontSize: 13 }}>{state.error}</p>}
      {state.summary && state.summary.count === 0 && <p style={{ margin: "8px 0 0", color: "#7a6a5a", fontSize: 13 }}>No closed deals recorded this month. This is an empty board, not a bank balance.</p>}
      {state.summary && state.summary.count > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginTop: 12 }}>
          <CashBit label="Sales closed" value={formatRM(state.summary.sales)} />
          <CashBit label="Collected" value={formatRM(state.summary.collected)} />
          <CashBit label="Still owed" value={formatRM(state.summary.owed)} />
          <CashBit label="Overdue" value={state.summary.overdueCount ? `${state.summary.overdueCount} · ${formatRM(state.summary.overdueOwed)}` : "None"} />
          <CashBit label="Provisional GP" value={gpText(state.summary.provisionalCount, state.summary.provisionalGp)} />
          <CashBit label="Final GP" value={gpText(state.summary.finalCount, state.summary.finalGp, state.summary.finalPct)} />
        </div>
      )}
    </div>
  );
}

function CashBit({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#9a8a7a", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: "#3a2a1a", marginTop: 2 }}>{value}</div>
    </div>
  );
}
