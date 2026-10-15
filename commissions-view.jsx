import { useState } from "react";
import { formatRM } from "./traffic-board-logic.js";
import { COMMISSION_PEOPLE, monthLabel } from "./commission-logic.js";

const inputStyle = {
  padding: "8px 10px",
  border: "1.5px solid #e8ddd5",
  borderRadius: 8,
  fontSize: 16,
  fontFamily: "inherit",
  color: "#3a2a1a",
  background: "#fff",
};

function pill(active) {
  return {
    background: active ? "#fde8d8" : "#fff",
    color: active ? "#c4704a" : "#5a4a3a",
    border: "1.5px solid " + (active ? "#c4704a" : "#e8ddd5"),
    borderRadius: 99,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function moneyCell(value, strong) {
  return {
    padding: "8px 10px",
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    color: "#3a2a1a",
    fontWeight: strong ? 800 : 500,
  };
}

function sumBy(rows, key) {
  return Math.round(rows.reduce((s, r) => s + (Number(r[key]) || 0), 0) * 100) / 100;
}

function yearTotals(months, key) {
  const people = (months || []).map(m => m.people.find(p => p.key === key)).filter(Boolean);
  const events = [];
  for (const month of months || []) {
    const person = month.people.find(p => p.key === key);
    if (!person) continue;
    for (const ev of person.paidEvents || []) {
      events.push({ ...ev, monthKey: month.monthKey, label: monthLabel(month.monthKey) });
    }
  }
  events.sort((a, b) => String(b.payrollDate).localeCompare(String(a.payrollDate)));
  return {
    paid: sumBy(people, "paid"),
    held: sumBy(people, "held"),
    ready: sumBy(people, "readyToPay"),
    pending: sumBy(people, "pending"),
    events,
  };
}

export function CommissionsView({
  year,
  years,
  onYear,
  months,
  monthKey,
  onMonth,
  canMarkPaid,
  tablesReady,
  migrationSql,
  audit,
  saving,
  loadError,
  actionError,
  onMarkPaid,
  onExclude,
  onInclude,
}) {
  const [payrollDate, setPayrollDate] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const month = (months || []).find(m => m.monthKey === monthKey) || months?.[0];
  const readyCard = month?.useDecision ? month.readyTotal : (month?.readyPayroll || 0);
  const entityTotal = (month?.entityBase.my || 0) + (month?.entityBase.sg || 0);
  const myPct = entityTotal ? Math.round((month.entityBase.my / entityTotal) * 1000) / 10 : 0;
  const sgPct = entityTotal ? Math.round((1000 - myPct * 10)) / 10 : 0;

  const cards = month ? [
    { label: "NPBT", value: formatRM(month.npbt), hint: monthLabel(month.monthKey) },
    { label: "Qualified", value: month.qualified ? "Yes" : "No", hint: month.qualified ? "NPBT is at least RM 100,000" : "NPBT is under RM 100,000" },
    { label: "Pool", value: formatRM(month.pool), hint: month.qualified ? "10% of NPBT, after exclusions" : "No pool this month" },
    { label: "Ready to pay", value: formatRM(readyCard), hint: month.useDecision ? `Payroll lines round to ${formatRM(month.readyPayroll)}` : "Cash already collected", wide: true },
    { label: "Held", value: formatRM(month.heldTotal), hint: "Waiting on collection" },
    { label: "Pending", value: formatRM(month.pendingTotal), hint: "Excluded until collected" },
    { label: "Paid", value: formatRM(month.paidTotal), hint: month.paidTotal ? "On a payroll already" : "Not marked paid" },
  ] : [];

  async function confirmPaid() {
    if (!payrollDate || saving) return;
    await onMarkPaid(payrollDate);
    setConfirming(false);
  }

  return (
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#3a2a1a" }}>💸 Commissions</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9a8a7a", maxWidth: 760, lineHeight: 1.45 }}>
            The pool is 10% of that month’s Net Profit Before Tax when NPBT is at least RM 100,000. Half is split evenly across King, Leon, Wilson, and Puteri. Half follows Scoreboard sales closed. Justin is not in the pool. Only profit backed by cash collected is ready to pay. Uncollected deals are held. A deal King excludes stays pending until the cash arrives.
          </p>
        </div>
        <label style={{ fontSize: 13, fontWeight: 700, color: "#5a4a3a" }}>
          Year{" "}
          <select value={year} onChange={e => onYear(Number(e.target.value))} style={{ ...inputStyle, width: "auto", marginLeft: 6 }}>
            {(years || [year]).map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {!canMarkPaid && (
        <div style={{ fontSize: 12, color: "#8a5a12", background: "#fff4e0", display: "inline-block", borderRadius: 99, padding: "4px 10px", margin: "8px 0 4px" }}>
          View only. An admin marks the batch paid on payroll day.
        </div>
      )}

      {loadError && <div style={{ background: "#fde8e8", color: "#a32020", borderRadius: 8, padding: "8px 12px", margin: "10px 0", fontSize: 13 }}>{loadError}</div>}

      {!tablesReady && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", border: "1.5px solid #f0ebe4", margin: "12px 0" }}>
          <div style={{ fontWeight: 800, color: "#3a2a1a" }}>One-time setup</div>
          <p style={{ margin: "4px 0 8px", color: "#7a6a5a", fontSize: 13, lineHeight: 1.5 }}>
            The tracker below is live. Recording a payroll, or excluding another deal, needs the commissions tables. The SQL only creates new tables and the July 2026 seed. It does not change existing tables.
          </p>
          <button type="button" onClick={() => setShowSql(v => !v)} style={{ background: "#fff", color: "#c4704a", border: "1.5px solid #c4704a", borderRadius: 8, padding: "6px 12px", fontWeight: 700, cursor: "pointer" }}>
            {showSql ? "Hide SQL" : "Show SQL"}
          </button>
          {showSql && (
            <>
              <pre style={{ background: "#faf7f3", border: "1px solid #ece3da", borderRadius: 8, padding: "12px 14px", fontSize: 11.5, overflowX: "auto", whiteSpace: "pre", color: "#5a4a3a", maxHeight: 180, marginTop: 8 }}>{migrationSql}</pre>
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(migrationSql); setCopied(true); } catch { setCopied(false); } }} style={{ background: "#c4704a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer", marginTop: 8 }}>
                {copied ? "Copied" : "Copy SQL"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="commission-month-scroller" style={{ display: "flex", gap: 8, overflowX: "auto", WebkitOverflowScrolling: "touch", paddingBottom: 4, margin: "12px 0" }}>
        {(months || []).map(m => (
          <button key={m.monthKey} type="button" onClick={() => onMonth(m.monthKey)} style={pill(m.monthKey === month?.monthKey)}>
            {monthLabel(m.monthKey).slice(0, 3)}
          </button>
        ))}
      </div>

      {month && (
        <>
          <div className="commission-summary" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 14 }}>
            {cards.map(card => (
              <div key={card.label} className={`commission-summary-card${card.wide ? " commission-card-wide" : ""}`} style={{ background: "#fff", borderRadius: 14, padding: "12px 14px", border: "1.5px solid #f0ebe4" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase", color: "#9a8a7a" }}>{card.label}</div>
                <div className="commission-card-value" style={{ fontSize: 18, fontWeight: 800, color: card.label === "Qualified" && !month.qualified ? "#a32020" : "#3a2a1a", marginTop: 4 }}>{card.value}</div>
                <div style={{ fontSize: 11, color: "#9a8a7a", marginTop: 2 }}>{card.hint}</div>
              </div>
            ))}
          </div>

          <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color: "#c4704a" }}>{monthLabel(month.monthKey)} by person</h3>
          <div className="table-scroll" style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f0ebe4", overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch", marginBottom: 8 }}>
            <table className="commission-table" style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "auto" }}>
              <thead>
                <tr style={{ background: "#faf7f3", textAlign: "left" }}>
                  {["Person", "Full share", "Paid", "Held", "Ready to pay", "Pending", "MY", "SG"].map(h => (
                    <th key={h} style={{ padding: "8px 10px", color: "#7a6a5a", fontSize: 11, fontWeight: 700, textAlign: h === "Person" ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {month.people.map(p => (
                  <tr key={p.key} style={{ borderTop: "1px solid #f0ebe4" }}>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: "#3a2a1a", whiteSpace: "nowrap" }}>{p.name}</td>
                    <td style={moneyCell(p.full)}>{formatRM(p.full)}</td>
                    <td style={moneyCell(p.paid)}>{formatRM(p.paid)}</td>
                    <td style={moneyCell(p.held)}>{formatRM(p.held)}</td>
                    <td style={moneyCell(p.readyToPay, true)}>{formatRM(p.readyToPay)}</td>
                    <td style={moneyCell(p.pending)}>{formatRM(p.pending)}</td>
                    <td style={moneyCell(p.readyMy)}>{formatRM(p.readyToPay ? p.readyMy : p.paidMy)}</td>
                    <td style={moneyCell(p.readySg)}>{formatRM(p.readyToPay ? p.readySg : p.paidSg)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid #eadfd5", background: "#faf7f3" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 800, color: "#3a2a1a", whiteSpace: "nowrap" }}>Total</td>
                  <td style={moneyCell(0, true)}>{formatRM(sumBy(month.people, "full"))}</td>
                  <td style={moneyCell(0, true)}>{formatRM(sumBy(month.people, "paid"))}</td>
                  <td style={moneyCell(0, true)}>{formatRM(sumBy(month.people, "held"))}</td>
                  <td style={moneyCell(0, true)}>{formatRM(sumBy(month.people, "readyToPay"))}</td>
                  <td style={moneyCell(0, true)}>{formatRM(sumBy(month.people, "pending"))}</td>
                  <td style={moneyCell(0, true)}>{formatRM(sumBy(month.people, month.readyPayroll ? "readyMy" : "paidMy"))}</td>
                  <td style={moneyCell(0, true)}>{formatRM(sumBy(month.people, month.readyPayroll ? "readySg" : "paidSg"))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p style={{ margin: "0 0 16px", fontSize: 12, color: "#9a8a7a", lineHeight: 1.45 }}>
            {month.useDecision
              ? `Shares are rounded to the cent. The scheme pool is ${formatRM(month.pool)} and the scheme ready amount is ${formatRM(month.readyTotal)}.`
              : "Full share is the month pool. Held is the part still waiting on cash. Ready to pay is what payroll can take."}
            {entityTotal > 0 ? ` MY ${myPct}% / SG ${sgPct}% follows this month’s Traffic Board amount, excluding deals that are pending until collected.` : ""}
          </p>

          <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color: "#c4704a" }}>People</h3>
          <div className="commission-person-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginBottom: 18 }}>
            {COMMISSION_PEOPLE.map(meta => {
              const totals = yearTotals(months, meta.key);
              const person = month.people.find(p => p.key === meta.key);
              return (
                <div key={meta.key} style={{ background: "#fff", borderRadius: 14, padding: "14px 14px 12px", border: "1.5px solid #f0ebe4" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#c4704a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800 }}>{meta.short.slice(0, 1)}{meta.short.slice(-1) === meta.short.slice(0, 1) ? "" : meta.name.split(" ")[1]?.[0] || ""}</div>
                    <div>
                      <div style={{ fontWeight: 800, color: "#3a2a1a" }}>{meta.name}</div>
                      <div style={{ fontSize: 11, color: "#9a8a7a" }}>{year} totals</div>
                    </div>
                  </div>
                  <div className="commission-card-value" style={{ fontSize: 20, fontWeight: 800, color: "#c4704a", marginTop: 10 }}>{formatRM(person?.readyToPay || 0)}</div>
                  <div style={{ fontSize: 11, color: "#9a8a7a" }}>Ready this month</div>
                  <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 12, color: "#5a4a3a", flexWrap: "wrap" }}>
                    <span>Paid {formatRM(totals.paid)}</span>
                    <span>Held {formatRM(totals.held)}</span>
                    <span>Pending {formatRM(totals.pending)}</span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: "#7a6a5a", lineHeight: 1.45 }}>
                    {totals.events.length === 0 && <div>No payroll recorded yet.</div>}
                    {totals.events.map(ev => (
                      <div key={`${ev.batchId}-${ev.payrollDate}`} style={{ whiteSpace: "nowrap" }}>
                        Paid {ev.payrollDate} · {formatRM(ev.amount)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color: "#c4704a" }}>Held and pending deals</h3>
          {month.deals.length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, color: "#9a8a7a", fontSize: 13, border: "1.5px solid #f0ebe4", marginBottom: 16 }}>
              {month.qualified ? "Nothing is waiting on collection this month." : "This month did not qualify, so nothing is held."}
            </div>
          ) : (
            <div className="table-scroll" style={{ background: "#fff", borderRadius: 14, border: "1.5px solid #f0ebe4", overflowX: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch", marginBottom: 16 }}>
              <table className="commission-table" style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "auto" }}>
                <thead>
                  <tr style={{ background: "#faf7f3", textAlign: "left" }}>
                    {["Status", "Project", "ACA", "Entity", "Amount", "Collected", "Outstanding", "Commission", ""].map(h => (
                      <th key={h || "act"} style={{ padding: "8px 10px", color: "#7a6a5a", fontSize: 11, fontWeight: 700, textAlign: ["Amount", "Collected", "Outstanding", "Commission"].includes(h) ? "right" : "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {month.deals.map(deal => (
                    <tr key={deal.id} style={{ borderTop: "1px solid #f0ebe4" }}>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                        <span style={{
                          background: deal.status === "pending" ? "#fde8e8" : "#fff4e0",
                          color: deal.status === "pending" ? "#a32020" : "#8a5a12",
                          borderRadius: 99,
                          padding: "3px 8px",
                          fontSize: 11,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                        }}>{deal.statusLabel}</span>
                      </td>
                      <td style={{ padding: "8px 10px", fontWeight: 700, color: "#3a2a1a", whiteSpace: "nowrap" }}>{deal.project_name}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap", color: "#5a4a3a" }}>{deal.aca_id || "—"}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{deal.entityShort}</td>
                      <td style={moneyCell(deal.amount)}>{formatRM(deal.amount)}</td>
                      <td style={moneyCell(deal.collected)}>{formatRM(deal.collected)}</td>
                      <td style={moneyCell(deal.outstanding)}>{formatRM(deal.outstanding)}</td>
                      <td style={moneyCell(deal.commission, true)}>{formatRM(deal.commission)}</td>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                        {canMarkPaid && deal.status === "held" && (
                          <button type="button" disabled={saving} onClick={() => onExclude(deal)} style={{ background: "#fff", color: "#8a5a12", border: "1.5px solid #e8ddd5", borderRadius: 8, padding: "4px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Exclude until collected</button>
                        )}
                        {canMarkPaid && deal.status === "pending" && (
                          <button type="button" disabled={saving} onClick={() => onInclude(deal)} style={{ background: "#fff", color: "#5a4a3a", border: "1.5px solid #e8ddd5", borderRadius: 8, padding: "4px 8px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Put back in the pool</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canMarkPaid && (
            <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", border: "1.5px solid #f0ebe4", marginBottom: 14 }}>
              <div style={{ fontWeight: 800, color: "#3a2a1a", marginBottom: 4 }}>Mark this month paid</div>
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "#7a6a5a", lineHeight: 1.45 }}>
                This locks {formatRM(month.readyPayroll)} for {monthLabel(month.monthKey)} on the payroll date you enter. A paid batch cannot be edited, and the same amount is not paid again.
              </p>
              {actionError && <div style={{ background: "#fde8e8", color: "#a32020", borderRadius: 8, padding: "8px 10px", marginBottom: 8, fontSize: 13 }}>{actionError}</div>}
              {!confirming ? (
                <button type="button" disabled={saving || !(month.readyPayroll > 0)} onClick={() => setConfirming(true)} style={{ background: month.readyPayroll > 0 ? "#c4704a" : "#e8ddd5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: month.readyPayroll > 0 ? "pointer" : "default" }}>
                  Mark batch paid
                </button>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "#5a4a3a" }}>
                    Payroll date{" "}
                    <input type="date" value={payrollDate} onChange={e => setPayrollDate(e.target.value)} style={{ ...inputStyle, width: "auto" }} />
                  </label>
                  <button type="button" disabled={saving || !payrollDate} onClick={confirmPaid} style={{ background: "#c4704a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}>
                    {saving ? "Saving…" : "Confirm paid"}
                  </button>
                  <button type="button" onClick={() => setConfirming(false)} style={{ background: "#fff", color: "#5a4a3a", border: "1.5px solid #e8ddd5", borderRadius: 8, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
                </div>
              )}
            </div>
          )}

          <button type="button" onClick={() => setShowAudit(v => !v)} style={{ background: "none", border: "none", color: "#c4704a", fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 13 }}>
            {showAudit ? "Hide audit trail" : "Audit trail"}
          </button>
          {showAudit && (
            <div style={{ marginTop: 8 }}>
              {(audit || []).length === 0 && <div style={{ color: "#9a8a7a", fontSize: 13 }}>No audit rows yet.</div>}
              {(audit || []).map(row => (
                <div key={row.id} style={{ fontSize: 12, color: "#5a4a3a", padding: "6px 0", borderBottom: "1px solid #f0ebe4" }}>
                  <strong>{row.user_name || "Someone"}</strong> {row.action} {row.month_key ? `· ${row.month_key}` : ""} {row.new_value ? `· ${row.new_value}` : ""}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
