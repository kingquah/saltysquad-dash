import { Fragment, useMemo, useState } from "react";
import {
  COST_TYPES,
  ENTITIES,
  SALES_TYPES,
  auditSentence,
  canLockCosts,
  collectionSnapshot,
  costTypeLabel,
  defaultCollectionDraft,
  deriveDeal,
  filterDeals,
  formatRM,
  gpText,
  groupByEntity,
  monthKeyFromDate,
  normalizeDealInput,
  summarize,
  todayISO,
  validateCollection,
  validateCost,
  validateDeal,
  marginText,
} from "./traffic-board-logic.js";

const STATUS_STYLE = {
  Open: { bg: "#e8f2fb", color: "#1a4d80" },
  Partial: { bg: "#fdf3e0", color: "#8a5a12" },
  Collected: { bg: "#d4edda", color: "#1a6630" },
  Overdue: { bg: "#fde8e8", color: "#a32020" },
};

const MARGIN_STYLE = {
  pending: { bg: "#fff4e0", color: "#8a5a12" },
  provisional: { bg: "#d0e8ff", color: "#1a4d80" },
  final: { bg: "#d4edda", color: "#1a6630" },
};

// Fixed shares so both entity tables line up and the row stays inside the viewport.
// Project / ACA / AC wrap; money stays on one line; margin and actions may wrap.
const BOARD_COLUMNS = [
  { key: "project", label: "Project", width: "14%" },
  { key: "aca", label: "ACA", width: "8%" },
  { key: "ac", label: "AC", width: "9%" },
  { key: "close", label: "Close", width: "9%" },
  { key: "amount", label: "Amount", width: "10%", align: "right" },
  { key: "collected", label: "Collected", width: "10%", align: "right" },
  { key: "owed", label: "Owed", width: "10%", align: "right" },
  { key: "status", label: "Status", width: "8%" },
  { key: "margin", label: "Margin", width: "8%" },
  { key: "actions", label: "", width: "14%" },
];

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1.5px solid #e8ddd5",
  fontSize: 14,
  color: "#3a2a1a",
  background: "#fff",
  boxSizing: "border-box",
  fontFamily: "inherit",
};

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#5a4a3a",
  marginBottom: 5,
};

function Badge({ text, bg, color, wrap = false }) {
  return (
    <span style={{
      background: bg,
      color,
      padding: "3px 8px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 700,
      whiteSpace: wrap ? "normal" : "nowrap",
      display: wrap ? "inline-block" : undefined,
      maxWidth: wrap ? "100%" : undefined,
      lineHeight: wrap ? 1.35 : undefined,
      boxSizing: "border-box",
      verticalAlign: "middle",
    }}>
      {text}
    </span>
  );
}

function auditTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function OpsBlock({ md }) {
  if (!md) return null;
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let list = null;
  const flush = () => {
    if (list) { blocks.push({ type: "ul", items: list }); list = null; }
  };
  for (const line of lines) {
    if (line.startsWith("# ")) { flush(); blocks.push({ type: "h1", text: line.slice(2) }); continue; }
    if (line.startsWith("## ")) { flush(); blocks.push({ type: "h2", text: line.slice(3) }); continue; }
    if (line.startsWith("- ")) {
      if (!list) list = [];
      list.push(line.slice(2));
      continue;
    }
    flush();
    if (line.trim()) blocks.push({ type: "p", text: line });
  }
  flush();
  const rich = text => text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  ));
  return (
    <div>
      {blocks.map((b, i) => {
        if (b.type === "h1") return <h3 key={i} style={{ margin: "0 0 8px", fontSize: 16, color: "#3a2a1a" }}>{b.text}</h3>;
        if (b.type === "h2") return <h4 key={i} style={{ margin: "14px 0 6px", fontSize: 13, color: "#c4704a" }}>{b.text}</h4>;
        if (b.type === "ul") return (
          <ul key={i} style={{ margin: "0 0 8px", paddingLeft: 18, color: "#5a4a3a", fontSize: 13, lineHeight: 1.55 }}>
            {b.items.map((item, j) => <li key={j}>{rich(item)}</li>)}
          </ul>
        );
        return <p key={i} style={{ margin: "0 0 8px", color: "#5a4a3a", fontSize: 13, lineHeight: 1.55 }}>{rich(b.text)}</p>;
      })}
    </div>
  );
}

function emptyDeal(today) {
  return {
    project_name: "",
    aca_id: "",
    entity: "saltyskins_my",
    ac_in_charge: "",
    lead_owner: "",
    product: "",
    qty: "",
    deal_close_date: today,
    sales_type: "Project",
    amount_myr: "",
    payment_terms: "",
    expected_collection_date: "",
    sales_entry_id: "",
  };
}

function dealToForm(deal) {
  return {
    project_name: deal.project_name || "",
    aca_id: deal.aca_id || "",
    entity: deal.entity || "saltyskins_my",
    ac_in_charge: deal.ac_in_charge || "",
    lead_owner: deal.lead_owner || "",
    product: deal.product || "",
    qty: deal.qty == null ? "" : String(deal.qty),
    deal_close_date: deal.deal_close_date || "",
    sales_type: deal.sales_type || "",
    amount_myr: deal.amount_myr == null ? "" : String(deal.amount_myr),
    payment_terms: deal.payment_terms || "",
    expected_collection_date: deal.expected_collection_date || "",
    sales_entry_id: deal.sales_entry_id ? String(deal.sales_entry_id) : "",
  };
}

function DealForm({ mode, initial, users, salesOptions, saving, onClose, onSubmit }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState([]);
  const [saleQuery, setSaleQuery] = useState("");
  const set = (key, value) => setValues(v => ({ ...v, [key]: value }));

  const names = useMemo(() => {
    const list = (users || []).map(u => u.name).filter(Boolean);
    for (const extra of [values.ac_in_charge, values.lead_owner]) {
      if (extra && !list.includes(extra)) list.push(extra);
    }
    return list;
  }, [users, values.ac_in_charge, values.lead_owner]);

  const sales = useMemo(() => {
    const q = saleQuery.trim().toLowerCase();
    const rows = salesOptions || [];
    if (!q) return rows.slice(0, 80);
    return rows.filter(s => `${s.client_name || ""} ${s.entry_date || ""} ${s.id}`.toLowerCase().includes(q)).slice(0, 80);
  }, [salesOptions, saleQuery]);

  function pickSale(id) {
    const sale = (salesOptions || []).find(s => String(s.id) === String(id));
    setValues(v => {
      const next = { ...v, sales_entry_id: id };
      if (!sale) return next;
      if (!String(v.project_name || "").trim()) next.project_name = sale.client_name || "";
      if (String(v.amount_myr || "").trim() === "") next.amount_myr = sale.amount ?? "";
      if (!v.deal_close_date) next.deal_close_date = sale.entry_date || "";
      return next;
    });
  }

  async function submit(e) {
    e.preventDefault();
    const input = normalizeDealInput(values);
    const local = validateDeal(input);
    if (local.length) { setErrors(local); return; }
    const result = await onSubmit(input);
    if (result?.errors?.length) setErrors(result.errors);
  }

  const field = (key, label, child) => (
    <div key={key} style={{ marginBottom: 12 }}>
      <label style={labelStyle}>{label}</label>
      {child}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(58,42,26,0.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 1000, overflowY: "auto", padding: "24px 12px 80px" }}>
      <form onSubmit={submit} style={{ background: "#fff", borderRadius: 16, padding: 24, width: "100%", maxWidth: 640, boxShadow: "0 8px 40px rgba(58,42,26,0.2)" }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 800, color: "#3a2a1a" }}>{mode === "edit" ? "Edit closed deal" : "Add closed deal"}</h3>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9a8a7a" }}>One row per job. Leave ACA ID blank only when there isn’t one yet. Don’t open a second row for the same ACA ID.</p>
        {errors.length > 0 && (
          <div style={{ background: "#fde8e8", color: "#a32020", borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 12 }}>
            {errors.map(err => <div key={err}>{err}</div>)}
          </div>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {field("project_name", "Project name", <input required value={values.project_name} onChange={e => set("project_name", e.target.value)} style={inputStyle} />)}
          {field("aca_id", "ACA ID", <input value={values.aca_id} onChange={e => set("aca_id", e.target.value)} placeholder="Optional, unique" style={inputStyle} />)}
          {field("entity", "Entity", (
            <select value={values.entity} onChange={e => set("entity", e.target.value)} style={inputStyle}>
              {ENTITIES.map(en => <option key={en.id} value={en.id}>{en.label}</option>)}
            </select>
          ))}
          {field("ac_in_charge", "AC in charge", (
            <select value={values.ac_in_charge} onChange={e => set("ac_in_charge", e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {names.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          ))}
          {field("lead_owner", "Lead owner (optional)", (
            <select value={values.lead_owner} onChange={e => set("lead_owner", e.target.value)} style={inputStyle}>
              <option value="">—</option>
              {names.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          ))}
          {field("product", "Product", <input value={values.product} onChange={e => set("product", e.target.value)} style={inputStyle} />)}
          {field("qty", "Qty", <input type="number" min="0" step="0.01" value={values.qty} onChange={e => set("qty", e.target.value)} style={inputStyle} />)}
          {field("deal_close_date", "Deal close date", <input type="date" value={values.deal_close_date} onChange={e => set("deal_close_date", e.target.value)} style={inputStyle} />)}
          {field("sales_type", "Sales type", (
            <>
              <input list="traffic-sales-types" value={values.sales_type} onChange={e => set("sales_type", e.target.value)} style={inputStyle} />
              <datalist id="traffic-sales-types">{SALES_TYPES.map(t => <option key={t} value={t} />)}</datalist>
            </>
          ))}
          {field("amount_myr", "Amount (MYR)", <input type="number" min="0" step="0.01" required value={values.amount_myr} onChange={e => set("amount_myr", e.target.value)} style={inputStyle} />)}
          {field("payment_terms", "Payment terms", <input value={values.payment_terms} onChange={e => set("payment_terms", e.target.value)} placeholder="e.g. 50/50, NET 30" style={inputStyle} />)}
          {field("expected_collection_date", "Expected collection date", <input type="date" value={values.expected_collection_date} onChange={e => set("expected_collection_date", e.target.value)} style={inputStyle} />)}
        </div>
        <div style={{ marginTop: 4, marginBottom: 16 }}>
          <label style={labelStyle}>Link a Scoreboard sale (optional)</label>
          <input value={saleQuery} onChange={e => setSaleQuery(e.target.value)} placeholder="Search client or date" style={{ ...inputStyle, marginBottom: 8 }} />
          <select value={values.sales_entry_id} onChange={e => pickSale(e.target.value)} style={inputStyle}>
            <option value="">Not linked</option>
            {values.sales_entry_id && !(salesOptions || []).some(s => String(s.id) === String(values.sales_entry_id)) && (
              <option value={values.sales_entry_id}>Linked sale #{values.sales_entry_id}</option>
            )}
            {sales.map(s => (
              <option key={s.id} value={s.id}>
                {s.entry_date || "no date"} · {s.client_name || "Untitled"} · {formatRM(s.amount)}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: "#9a8a7a", marginTop: 4 }}>Picking a sale fills empty name, amount, and close date from that row. It does not invent a balance.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" disabled={saving} style={{ flex: 1, background: "#c4704a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving…" : "Save deal"}
          </button>
          <button type="button" onClick={onClose} style={{ flex: 1, background: "#f0ebe4", color: "#5a4a3a", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function EventForm({ kind, draft, saving, onChange, onSave, onCancel }) {
  const [errors, setErrors] = useState([]);
  async function save(e) {
    e.preventDefault();
    const local = kind === "collection" ? validateCollection(draft) : validateCost(draft);
    if (local.length) { setErrors(local); return; }
    const result = await onSave();
    if (result?.errors?.length) setErrors(result.errors);
  }
  return (
    <form onSubmit={save} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, alignItems: "end", marginTop: 8 }}>
      {kind === "collection" ? (
        <div>
          <label style={labelStyle}>Date money arrived</label>
          <input type="date" required value={draft.collected_at} onChange={e => onChange({ collected_at: e.target.value })} style={inputStyle} />
        </div>
      ) : (
        <>
          <div>
            <label style={labelStyle}>Cost date</label>
            <input type="date" required value={draft.cost_date} onChange={e => onChange({ cost_date: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={draft.cost_type} onChange={e => onChange({ cost_type: e.target.value })} style={inputStyle}>
              {COST_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
        </>
      )}
      <div>
        <label style={labelStyle}>Amount (MYR)</label>
        <input type="number" min="0" step="0.01" required value={draft.amount} onChange={e => onChange({ amount: e.target.value })} style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Note</label>
        <input value={draft.note || ""} onChange={e => onChange({ note: e.target.value })} style={inputStyle} />
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="submit" disabled={saving} style={{ background: "#c4704a", color: "#fff", border: "none", borderRadius: 8, padding: "9px 12px", fontWeight: 700, cursor: "pointer" }}>
          {saving ? "Saving…" : kind === "collection" ? "Save collection" : "Save cost"}
        </button>
        <button type="button" onClick={onCancel} style={{ background: "#f0ebe4", color: "#5a4a3a", border: "none", borderRadius: 8, padding: "9px 12px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
      </div>
      {errors.length > 0 && <div style={{ gridColumn: "1 / -1", color: "#a32020", fontSize: 12 }}>{errors.join(" ")}</div>}
    </form>
  );
}

function DealDetails({ deal, canWrite, saving, today, draft, setDraft, salesOptions, onSaveCollection, onDeleteCollection, onSaveCost, onDeleteCost, onSetLocked }) {
  const locked = !!deal.costs_locked;
  const sale = (salesOptions || []).find(s => String(s.id) === String(deal.sales_entry_id));
  const showCollectionForm = draft?.dealId === deal.id && draft.kind === "collection";
  const showCostForm = draft?.dealId === deal.id && draft.kind === "cost";

  function startCollection(prefillRemaining) {
    const base = prefillRemaining
      ? defaultCollectionDraft(deal.remaining, today)
      : { collected_at: today, amount: "", note: "" };
    setDraft({ dealId: deal.id, kind: "collection", editingId: null, cost_date: today, cost_type: "fabric_print", ...base });
  }

  return (
    <div style={{ background: "#faf7f3", padding: "14px 16px 18px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 14, fontSize: 13, color: "#5a4a3a" }}>
        <div><strong>Product</strong><br />{deal.product || "—"}</div>
        <div><strong>Qty</strong><br />{deal.qty == null || deal.qty === "" ? "—" : String(deal.qty)}</div>
        <div><strong>Sales type</strong><br />{deal.sales_type || "—"}</div>
        <div><strong>Payment terms</strong><br />{deal.payment_terms || "—"}</div>
        <div><strong>Lead owner</strong><br />{deal.lead_owner || "—"}</div>
        <div><strong>Expected collection</strong><br />{deal.expected_collection_date || "—"}</div>
        <div><strong>Scoreboard link</strong><br />{deal.sales_entry_id ? (sale ? `${sale.entry_date} · ${sale.client_name}` : `#${deal.sales_entry_id}`) : "Not linked"}</div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 12, marginBottom: 10, border: "1px solid #f0ebe4" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <strong style={{ color: "#3a2a1a", fontSize: 14 }}>Collections</strong>
          {canWrite && deal.status !== "Collected" && (
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={() => startCollection(true)} style={smallBtn("#c4704a", "#fff")}>Mark collected</button>
              <button type="button" onClick={() => startCollection(false)} style={smallBtn("#fff", "#c4704a", "#e8ddd5")}>Add partial</button>
            </span>
          )}
          {canWrite && deal.status === "Collected" && (
            <button type="button" onClick={() => startCollection(false)} style={smallBtn("#fff", "#c4704a", "#e8ddd5")}>Add collection</button>
          )}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9a8a7a" }}>Mark collected opens a line with today’s date and the amount still owed. Change either before you save. A date with no amount is not saved.</p>
        {deal.collections.length === 0 && <div style={{ fontSize: 13, color: "#9a8a7a", marginTop: 8 }}>No collections yet.</div>}
        {deal.collections.map(c => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid #f5f0ec", fontSize: 13 }}>
            <span>{collectionSnapshot(c)}{c.recorded_by_name ? ` · ${c.recorded_by_name}` : ""}</span>
            {canWrite && (
              <span style={{ whiteSpace: "nowrap" }}>
                <button type="button" onClick={() => setDraft({ dealId: deal.id, kind: "collection", editingId: c.id, collected_at: c.collected_at, amount: String(c.amount), note: c.note || "", cost_date: today, cost_type: "fabric_print" })} style={textBtn("#c4704a")}>Edit</button>
                <button type="button" onClick={() => onDeleteCollection(deal, c)} style={textBtn("#e74c3c")}>Delete</button>
              </span>
            )}
          </div>
        ))}
        {showCollectionForm && (
          <EventForm
            kind="collection"
            draft={draft}
            saving={saving}
            onChange={patch => setDraft({ ...draft, ...patch })}
            onCancel={() => setDraft(null)}
            onSave={() => onSaveCollection(deal, draft)}
          />
        )}
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 12, border: "1px solid #f0ebe4" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ color: "#3a2a1a", fontSize: 14 }}>Costs</strong>
            {deal.margin.state === "final" && (
              <Badge text={marginText(deal.margin)} bg={MARGIN_STYLE.final.bg} color={MARGIN_STYLE.final.color} wrap />
            )}
          </span>
          {canWrite && (
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {!locked && <button type="button" onClick={() => setDraft({ dealId: deal.id, kind: "cost", editingId: null, collected_at: today, amount: "", note: "", cost_date: today, cost_type: "fabric_print" })} style={smallBtn("#fff", "#c4704a", "#e8ddd5")}>Add cost</button>}
              {!locked && (
                <button type="button" disabled={!canLockCosts(deal.costs)} title={canLockCosts(deal.costs) ? "Mark these costs as final" : "Enter at least one cost first"} onClick={() => onSetLocked(deal, true)} style={smallBtn(canLockCosts(deal.costs) ? "#1a6630" : "#cfc6be", "#fff")}>Lock costs</button>
              )}
              {locked && <button type="button" onClick={() => onSetLocked(deal, false)} style={smallBtn("#fff", "#8a5a12", "#e8ddd5")}>Unlock costs</button>}
            </span>
          )}
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9a8a7a" }}>
          {deal.margin.state === "pending"
            ? "No cost entered. Margin stays “cost pending” — this is not 100% profit."
            : locked
              ? "Costs are locked. Gross profit is final until someone unlocks."
              : "Costs are in, but not locked. Gross profit is provisional."}
        </p>
        {deal.costs.map(c => (
          <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid #f5f0ec", fontSize: 13 }}>
            <span>{c.cost_date} · {costTypeLabel(c.cost_type)} · {formatRM(c.amount)}{c.note ? ` · ${c.note}` : ""}{c.recorded_by_name ? ` · ${c.recorded_by_name}` : ""}</span>
            {canWrite && !locked && (
              <span style={{ whiteSpace: "nowrap" }}>
                <button type="button" onClick={() => setDraft({ dealId: deal.id, kind: "cost", editingId: c.id, cost_date: c.cost_date, cost_type: c.cost_type, amount: String(c.amount), note: c.note || "", collected_at: today })} style={textBtn("#c4704a")}>Edit</button>
                <button type="button" onClick={() => onDeleteCost(deal, c)} style={textBtn("#e74c3c")}>Delete</button>
              </span>
            )}
          </div>
        ))}
        {showCostForm && !locked && (
          <EventForm
            kind="cost"
            draft={draft}
            saving={saving}
            onChange={patch => setDraft({ ...draft, ...patch })}
            onCancel={() => setDraft(null)}
            onSave={() => onSaveCost(deal, draft)}
          />
        )}
      </div>
    </div>
  );
}

function smallBtn(bg, color, border = "transparent") {
  return { background: bg, color, border: `1.5px solid ${border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
}
function textBtn(color) {
  return { background: "none", border: "none", color, cursor: "pointer", fontSize: 12, fontWeight: 700, marginLeft: 8 };
}

export function TrafficBoardView({
  canWrite,
  users = [],
  deals = [],
  collections = [],
  costs = [],
  audit = [],
  salesOptions = [],
  saving = false,
  today = todayISO(),
  initialMonth,
  opsMd = "",
  initialExpanded = null,
  onCreateDeal,
  onUpdateDeal,
  onDeleteDeal,
  onSaveCollection,
  onDeleteCollection,
  onSaveCost,
  onDeleteCost,
  onSetLocked,
}) {
  const [month, setMonth] = useState(initialMonth || monthKeyFromDate(new Date(`${today}T12:00:00`)));
  const [entity, setEntity] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(initialExpanded);
  const [dealForm, setDealForm] = useState(null);
  const [draft, setDraft] = useState(null);
  const [showAudit, setShowAudit] = useState(false);
  const [showOps, setShowOps] = useState(false);

  const derived = useMemo(
    () => (deals || []).map(d => deriveDeal(d, collections, costs, today)),
    [deals, collections, costs, today],
  );
  const filtered = useMemo(
    () => filterDeals(derived, { month, entity, search }),
    [derived, month, entity, search],
  );
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const groups = useMemo(() => groupByEntity(filtered, entity), [filtered, entity]);

  const cards = [
    { label: "Sales closed", value: summary.count ? formatRM(summary.sales) : "—", hint: summary.count ? `${summary.count} deal${summary.count === 1 ? "" : "s"}` : "Nothing recorded" },
    { label: "Collected", value: summary.count ? formatRM(summary.collected) : "—", hint: "Sum of collection lines" },
    { label: "Still owed", value: summary.count ? formatRM(summary.owed) : "—", hint: "Deal amount minus collections" },
    { label: "COGS entered", value: summary.count ? formatRM(summary.cogs) : "—", hint: summary.pendingCount ? `${summary.pendingCount} still cost pending` : "From cost lines only" },
    { label: "Provisional GP", value: gpText(summary.provisionalCount, summary.provisionalGp), hint: summary.provisionalCount ? `${summary.provisionalCount} unlocked` : "No provisional jobs" },
    { label: "Final GP", value: gpText(summary.finalCount, summary.finalGp, summary.finalPct), hint: summary.finalCount ? `${summary.finalCount} locked` : "No locked jobs" },
    { label: "Overdue", value: summary.overdueCount ? String(summary.overdueCount) : "0", hint: summary.overdueCount ? `${formatRM(summary.overdueOwed)} still owed` : "None past the expected date" },
  ];

  async function submitDeal(input) {
    if (dealForm.mode === "edit") return onUpdateDeal(dealForm.deal, input);
    return onCreateDeal(input);
  }

  return (
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#3a2a1a" }}>🚦 Traffic Board</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9a8a7a", maxWidth: 720 }}>
            Closed jobs, cash in, and cost. Collection status comes from dated amounts, not a YES/NO tick. Margin stays “cost pending” until a cost line exists.
          </p>
        </div>
        {canWrite && (
          <button type="button" onClick={() => setDealForm({ mode: "add", initial: emptyDeal(today) })} style={{ background: "#c4704a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}>
            Add closed deal
          </button>
        )}
      </div>
      {!canWrite && <div style={{ fontSize: 12, color: "#8a5a12", background: "#fff4e0", display: "inline-block", borderRadius: 99, padding: "4px 10px", marginBottom: 12 }}>View only. Supervisors record collections and costs.</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", margin: "12px 0" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#5a4a3a" }}>Close month</span>
        <input type="month" value={month === "all" ? monthKeyFromDate(new Date(`${today}T12:00:00`)) : month} disabled={month === "all"} onChange={e => setMonth(e.target.value)} style={{ ...inputStyle, width: "auto" }} />
        <button type="button" onClick={() => setMonth(month === "all" ? monthKeyFromDate(new Date(`${today}T12:00:00`)) : "all")} style={smallBtn(month === "all" ? "#3a2a1a" : "#fff", month === "all" ? "#fff" : "#5a4a3a", "#e8ddd5")}>
          {month === "all" ? "All months on" : "All months"}
        </button>
        {ENTITIES.map(en => (
          <button key={en.id} type="button" onClick={() => setEntity(entity === en.id ? "all" : en.id)} style={smallBtn(entity === en.id ? "#fde8d8" : "#fff", entity === en.id ? "#c4704a" : "#5a4a3a", entity === en.id ? "#c4704a" : "#e8ddd5")}>
            {en.label}
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search project, ACA, AC" style={{ ...inputStyle, width: 220 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 8 }}>
        {cards.map(card => (
          <div key={card.label} style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", border: "1.5px solid #f0ebe4" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "#9a8a7a" }}>{card.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#3a2a1a", marginTop: 4 }}>{card.value}</div>
            <div style={{ fontSize: 11, color: "#9a8a7a", marginTop: 2 }}>{card.hint}</div>
          </div>
        ))}
      </div>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9a8a7a" }}>
        {summary.count === 0
          ? "Nothing on the board for this filter. Dashes are empty records, not a bank balance."
          : "Totals are only the deals in this filter. Provisional and final GP skip jobs that still say cost pending."}
      </p>

      {groups.map(group => (
        <section key={group.id} style={{ marginBottom: 18 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color: "#c4704a" }}>{group.label}</h3>
          {group.deals.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, color: "#9a8a7a", fontSize: 13, border: "1.5px solid #f0ebe4" }}>No deals in this section.</div>
          ) : (
            <div className="table-scroll" style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f0ebe4", overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch" }}>
              <table className="traffic-board-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
                <colgroup>
                  {BOARD_COLUMNS.map(col => <col key={col.key} style={{ width: col.width }} />)}
                </colgroup>
                <thead>
                  <tr style={{ background: "#faf7f3", textAlign: "left" }}>
                    {BOARD_COLUMNS.map(col => (
                      <th key={col.key} style={{
                        padding: "8px 8px",
                        color: "#7a6a5a",
                        fontSize: 11,
                        fontWeight: 700,
                        textAlign: col.align || "left",
                        overflowWrap: "anywhere",
                        ...(col.key === "project" ? { position: "sticky", left: 0, zIndex: 2, background: "#faf7f3" } : null),
                      }}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.deals.map(deal => {
                    const st = STATUS_STYLE[deal.status] || STATUS_STYLE.Open;
                    const mg = MARGIN_STYLE[deal.margin.state] || MARGIN_STYLE.pending;
                    const open = expanded === deal.id;
                    const td = { padding: "8px 8px", color: "#5a4a3a", verticalAlign: "top" };
                    const wrapTd = { ...td, overflowWrap: "anywhere" };
                    const moneyTd = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
                    const stickyProject = { position: "sticky", left: 0, zIndex: 1, background: "#fff", boxShadow: "1px 0 0 #f0ebe4" };
                    return (
                      <Fragment key={deal.id}>
                        <tr style={{ borderTop: "1px solid #f5f0ec" }}>
                          <td style={{ ...wrapTd, ...stickyProject, fontWeight: 700, color: "#3a2a1a" }}>{deal.project_name}</td>
                          <td style={wrapTd}>{deal.aca_id || "—"}</td>
                          <td style={wrapTd}>{deal.ac_in_charge || "—"}</td>
                          <td style={{ ...td, whiteSpace: "nowrap" }}>{deal.deal_close_date || "—"}</td>
                          <td style={{ ...moneyTd, fontWeight: 700, color: "#3a2a1a" }}>{formatRM(deal.amount)}</td>
                          <td style={moneyTd}>
                            {formatRM(deal.collected)}
                            {deal.overpaid > 0 && <div style={{ fontSize: 11, color: "#1a4d80", whiteSpace: "normal" }}>Over by {formatRM(deal.overpaid)}</div>}
                          </td>
                          <td style={moneyTd}>{formatRM(deal.remaining)}</td>
                          <td style={td}><Badge text={deal.status} bg={st.bg} color={st.color} /></td>
                          <td style={td} data-margin={deal.margin.state} data-status={deal.status}>
                            <Badge text={marginText(deal.margin)} bg={mg.bg} color={mg.color} wrap />
                          </td>
                          <td style={td}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
                              <button type="button" onClick={() => setExpanded(open ? null : deal.id)} style={{ ...textBtn("#5a4a3a"), marginLeft: 0 }}>{open ? "Hide" : "Open"}</button>
                              {canWrite && <button type="button" onClick={() => setDealForm({ mode: "edit", deal, initial: dealToForm(deal) })} style={{ ...textBtn("#c4704a"), marginLeft: 0 }}>Edit</button>}
                              {canWrite && <button type="button" onClick={() => { if (window.confirm(`Delete “${deal.project_name}”? Collections and costs on this job go with it.`)) onDeleteDeal(deal); }} style={{ ...textBtn("#e74c3c"), marginLeft: 0 }}>Delete</button>}
                            </div>
                          </td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={10} style={{ padding: 0 }}>
                              <DealDetails
                                deal={deal}
                                canWrite={canWrite}
                                saving={saving}
                                today={today}
                                draft={draft}
                                setDraft={setDraft}
                                salesOptions={salesOptions}
                                onSaveCollection={async (d, row) => {
                                  const result = await onSaveCollection(d, row);
                                  if (!result?.errors?.length) setDraft(null);
                                  return result;
                                }}
                                onDeleteCollection={onDeleteCollection}
                                onSaveCost={async (d, row) => {
                                  const result = await onSaveCost(d, row);
                                  if (!result?.errors?.length) setDraft(null);
                                  return result;
                                }}
                                onDeleteCost={onDeleteCost}
                                onSetLocked={async (d, locked) => {
                                  const result = await onSetLocked(d, locked);
                                  if (result?.errors?.length) window.alert(result.errors.join("\n"));
                                  return result;
                                }}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f0ebe4", padding: "14px 16px", marginTop: 8 }}>
        <button type="button" onClick={() => setShowOps(v => !v)} style={{ background: "none", border: "none", padding: 0, fontWeight: 800, color: "#3a2a1a", cursor: "pointer", fontSize: 14 }}>
          {showOps ? "▾" : "▸"} How we use this board
        </button>
        {showOps && <div style={{ marginTop: 10 }}><OpsBlock md={opsMd} /></div>}
      </div>

      <div style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f0ebe4", padding: "14px 16px", marginTop: 12 }}>
        <button type="button" onClick={() => setShowAudit(v => !v)} style={{ background: "none", border: "none", padding: 0, fontWeight: 800, color: "#3a2a1a", cursor: "pointer", fontSize: 14 }}>
          {showAudit ? "▾" : "▸"} Audit trail ({audit.length})
        </button>
        {showAudit && (
          <div style={{ marginTop: 10 }}>
            {audit.length === 0 && <div style={{ color: "#9a8a7a", fontSize: 13 }}>No changes recorded yet.</div>}
            {audit.map(row => (
              <div key={row.id} style={{ display: "flex", gap: 10, justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f5f0ec", fontSize: 13, color: "#5a4a3a" }}>
                <span>{auditSentence(row)}</span>
                <span style={{ color: "#b0a294", whiteSpace: "nowrap" }}>{auditTime(row.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {dealForm && (
        <DealForm
          mode={dealForm.mode}
          initial={dealForm.initial}
          users={users}
          salesOptions={salesOptions}
          saving={saving}
          onClose={() => setDealForm(null)}
          onSubmit={async input => {
            const result = await submitDeal(input);
            if (!result?.errors?.length) setDealForm(null);
            return result;
          }}
        />
      )}
    </div>
  );
}
