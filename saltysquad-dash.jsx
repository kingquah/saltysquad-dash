import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";

// ── STATIC / CONFIG DATA ──────────────────────────────────────────────────────

const CHECKLIST_SECTIONS = [
  {
    id: "responsiveness", label: "Responsiveness", items: [
      { id: "r1", text: "Replied to all official matters (emails/texts/calls)" },
      { id: "r2", text: "No silence that blocks work or decisions" },
      { id: "r3", text: "Returned or acknowledged updates/calls promptly — on time, accurate" },
    ]
  },
  {
    id: "punctuality", label: "Punctuality & Preparedness", items: [
      { id: "p1", text: "Arrived on time or early for official meetings and engagements" },
      { id: "p2", text: "Informed before time if unavoidable delay" },
      { id: "p3", text: "Read and prepared all pre-reads/agendas prior" },
      { id: "p4", text: "Brought required updates / data / facts" },
      { id: "p5", text: "Able to participate and contribute in discussions" },
    ]
  },
  {
    id: "work_delivery", label: "Work Delivery", items: [
      { id: "w1", text: "All tasks delivered on or before deadline" },
      { id: "w2", text: "Delays communicated in advance" },
      { id: "w3", text: "Quality of work is above acceptable range" },
    ]
  },
  {
    id: "weekly_improvements", label: "Weekly Improvements", items: [
      { id: "wi1", text: "No repeated mistakes after feedback" },
      { id: "wi2", text: "No reminders needed for basic duties" },
      { id: "wi3", text: "Did not slow others down due to personal defect/delay" },
    ]
  },
  {
    id: "professional_maturity", label: "Professional Maturity", items: [
      { id: "pm1", text: "No waiting to be told what to do" },
      { id: "pm2", text: "No poor documentation" },
      { id: "pm3", text: "Have good prioritisation sense" },
      { id: "pm4", text: "Not defensive when corrected" },
    ]
  },
];

const ALL_ITEM_IDS = CHECKLIST_SECTIONS.flatMap(s => s.items.map(i => i.id));
const TOTAL_ITEMS = ALL_ITEM_IDS.length;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const CORE_DOCS = [
  {
    id: "sst", title: "Single Source of Truth", icon: "📘",
    content: `# Single Source of Truth\n\nThis document serves as the definitive reference for all operational, process, and policy information within Saltysquad.\n\n## Purpose\nTo ensure all team members work from the same verified information and avoid conflicting data or decisions.\n\n## Principles\n- All official figures, targets, and decisions are recorded here first.\n- Any update must be approved by admin before being communicated.\n- When in doubt, refer to this document before acting.\n\n## Scope\nCovers sales targets, leave entitlements, role responsibilities, and key operational workflows.\n\n*Last updated by Admin. Contact king@saltycustoms.com for amendments.*`
  },
  {
    id: "ma", title: "Mutual Agreement", icon: "🤝",
    content: `# Mutual Agreement\n\nThis agreement outlines the expectations and commitments between Saltysquad and its team members.\n\n## Our Commitment to You\n- Fair and transparent performance evaluation.\n- Clear communication of targets and expectations.\n- Supportive environment for growth and improvement.\n\n## Your Commitment to Us\n- Uphold the values outlined in the Professional Integrity Checklist.\n- Communicate proactively about blockers or delays.\n- Maintain professional conduct at all times.\n\n## Review Cycle\nThis agreement is reviewed annually or upon role changes.\n\n*Signed digitally upon onboarding.*`
  },
  {
    id: "nda", title: "Confidentiality & Non-Disclosure", icon: "🔒",
    content: `# Confidentiality & Non-Disclosure Agreement\n\n## What is Confidential\n- Client names, contacts, and purchase history.\n- Internal pricing, margins, and supplier information.\n- Team performance data and personal HR records.\n- Business strategies, upcoming launches, and campaigns.\n\n## Your Obligations\n- Do not share confidential information with third parties.\n- Do not use confidential information for personal gain.\n- Report any accidental disclosure to admin immediately.\n\n## Duration\nThis obligation continues for 2 years after employment ends.\n\n## Breach of Confidentiality\nMay result in disciplinary action including termination and legal proceedings.\n\n*This NDA is binding upon your employment with Saltysquad.*`
  },
  {
    id: "gr", title: "Golden Rules", icon: "⭐",
    content: `# Saltysquad Golden Rules\n\nThese rules are non-negotiable and apply to every team member at every level.\n\n## The 5 Golden Rules\n\n**1. Communicate Early, Not Late**\nIf something is delayed, broken, or uncertain — say so before it becomes a problem.\n\n**2. Own Your Work**\nTake full responsibility for your tasks. No passing the blame.\n\n**3. Respect Everyone's Time**\nBe punctual. Prepare before meetings. Keep updates concise and actionable.\n\n**4. One Team, One Goal**\nSupport colleagues. Celebrate wins together. Solve problems together.\n\n**5. Keep Growing**\nMistakes are allowed once. Learn, improve, and never repeat them.\n\n---\n*These rules exist not to restrict you, but to protect the team's trust and momentum.*`
  },
];

// ── DB ROW MAPPERS ────────────────────────────────────────────────────────────

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    role: row.role,
    title: row.job_title,
    avatar: row.avatar,
    annualLeft: row.annual_left,
  };
}

function mapLeave(row) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    from: row.from_date,
    to: row.to_date,
    days: row.days,
    reason: row.reason,
    status: row.status,
  };
}

function mapSales(row) {
  return {
    id: row.id,
    month: row.month,
    year: Number(row.year),
    target: Number(row.target ?? 0),
    achieved: Number(row.achieved ?? 0),
  };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function scoreOf(checks) {
  if (!checks) return 0;
  return Object.values(checks).filter(Boolean).length;
}

function pct(checks) {
  return Math.round((scoreOf(checks) / TOTAL_ITEMS) * 100);
}

function statusColor(status) {
  if (status === "Approved") return "#2ecc71";
  if (status === "Rejected") return "#e74c3c";
  return "#f39c12";
}

function Bar({ value, max, color }) {
  const w = Math.round((value / max) * 100);
  return (
    <div style={{ background: "#ede8e3", borderRadius: 99, height: 8, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.5s ease" }} />
    </div>
  );
}

// ── LOADING SCREEN ────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf7f3", fontFamily: '-apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}>
      <style>{`@keyframes ss-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", border: "4px solid #fde8d8", borderTopColor: "#c4704a", animation: "ss-spin 0.7s linear infinite", margin: "0 auto 16px" }} />
        <div style={{ fontSize: 22, fontWeight: 800, color: "#c4704a", marginBottom: 4 }}>SALTYSQUAD</div>
        <div style={{ fontSize: 13, color: "#9a8a7a" }}>Loading your dashboard…</div>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [users, setUsers] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [sales, setSales] = useState([]);
  const [checklists, setChecklists] = useState({});
  const [docModal, setDocModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      const [usersRes, leaveRes, salesRes, checklistRes] = await Promise.all([
        supabase.from("users").select("*"),
        supabase.from("leave_requests").select("*"),
        supabase.from("sales_targets").select("*").order("year").order("id"),
        supabase.from("checklist_submissions").select("*"),
      ]);
      if (cancelled) return;

      console.log("[loadData] salesRes data:", salesRes.data, "error:", salesRes.error);

      if (usersRes.data) setUsers(usersRes.data.map(mapUser));
      if (leaveRes.data) setLeaveRequests(leaveRes.data.map(mapLeave));
      if (salesRes.data) setSales(salesRes.data.map(mapSales));
      if (checklistRes.data) {
        const map = {};
        for (const row of checklistRes.data) {
          if (!map[row.user_id]) map[row.user_id] = {};
          map[row.user_id][row.month_key] = { checks: row.checks || {}, remarks: row.remarks || "" };
        }
        setChecklists(map);
      }
      setLoading(false);
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LoadingScreen />;

  if (!currentUser) return <Login users={users} onLogin={u => { setCurrentUser(u); setPage("dashboard"); }} />;

  const isAdmin = currentUser.role === "admin" || currentUser.role === "supervisor";

  async function handleLeaveAction(id, action) {
    const req = leaveRequests.find(l => l.id === id);
    if (!req) return;

    const { error } = await supabase
      .from("leave_requests")
      .update({ status: action })
      .eq("id", id);
    if (error) {
      console.error("[handleLeaveAction] Supabase error:", error);
      return;
    }

    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status: action } : l));

    if (action === "Approved") {
      const u = users.find(u => u.id === req.userId);
      if (!u) return;
      const newBalance = Math.max(0, u.annualLeft - req.days);
      const { error: balErr } = await supabase
        .from("users")
        .update({ annual_left: newBalance })
        .eq("id", req.userId);
      if (!balErr) {
        setUsers(prev => prev.map(u => u.id !== req.userId ? u : { ...u, annualLeft: newBalance }));
        if (req.userId === currentUser.id) {
          setCurrentUser(prev => ({ ...prev, annualLeft: newBalance }));
        }
      }
    }
  }

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "leave", label: "Leave", icon: "🌴" },
    { id: "checklist", label: "Integrity", icon: "✅" },
    { id: "sales", label: "Sales", icon: "📊" },
    { id: "docs", label: "Documents", icon: "📁" },
    ...(isAdmin ? [{ id: "admin", label: "Admin", icon: "⚙️" }] : []),
  ];

  return (
    <div style={{ fontFamily: '-apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif', background: "#faf7f3", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* TOP NAV */}
      <header className="top-header" style={{ background: "#fff", borderBottom: "2px solid #f0ebe4", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#c4704a", letterSpacing: "-0.5px" }}>SALTY</span>
          <span style={{ fontSize: 22, fontWeight: 400, color: "#5a4a3a", letterSpacing: "-0.5px" }}>SQUAD</span>
          <span style={{ background: "#fde8d8", color: "#c4704a", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, marginLeft: 4, letterSpacing: 1 }}>DASH</span>
        </div>
        <nav className="top-nav" style={{ display: "flex", gap: 4 }}>
          {nav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ background: page === n.id ? "#fde8d8" : "transparent", color: page === n.id ? "#c4704a" : "#7a6a5a", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: page === n.id ? 700 : 400, transition: "all 0.15s" }}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#c4704a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{currentUser.avatar}</div>
          <div>
            <div className="header-user-name" style={{ fontSize: 13, fontWeight: 600, color: "#3a2a1a" }}>{currentUser.name}</div>
            <div className="header-user-title" style={{ fontSize: 11, color: "#c4704a" }}>{currentUser.title}</div>
          </div>
          <button onClick={() => setCurrentUser(null)} style={{ background: "none", border: "1px solid #e0d5cc", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#7a6a5a" }}>Sign out</button>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main className="main-content" style={{ flex: 1, padding: "28px 32px", maxWidth: 1200, width: "100%", margin: "0 auto" }}>
        {page === "dashboard" && <DashboardPage currentUser={currentUser} users={users} leaveRequests={leaveRequests} checklists={checklists} sales={sales} isAdmin={isAdmin} setPage={setPage} onLeaveAction={handleLeaveAction} />}
        {page === "leave" && <LeavePage currentUser={currentUser} users={users} setUsers={setUsers} leaveRequests={leaveRequests} setLeaveRequests={setLeaveRequests} isAdmin={isAdmin} onLeaveAction={handleLeaveAction} />}

        {page === "checklist" && <ChecklistPage currentUser={currentUser} users={users} checklists={checklists} setChecklists={setChecklists} isAdmin={isAdmin} />}
        {page === "sales" && <SalesPage sales={sales} setSales={setSales} isAdmin={isAdmin} />}
        {page === "docs" && <DocsPage docModal={docModal} setDocModal={setDocModal} />}
        {page === "admin" && isAdmin && <AdminPage users={users} setUsers={setUsers} leaveRequests={leaveRequests} setLeaveRequests={setLeaveRequests} checklists={checklists} />}
      </main>

      {/* BOTTOM TAB BAR — mobile only, controlled by CSS */}
      <nav className="bottom-tab-bar">
        {nav.map(n => (
          <button key={n.id} className={`bottom-tab-btn${page === n.id ? " active" : ""}`} onClick={() => setPage(n.id)}>
            <span className="bottom-tab-icon">{n.icon}</span>
            <span className="bottom-tab-label">{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────

function Login({ users, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleLogin(e) {
    if (e) e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const u = users.find(u => u.email.toLowerCase() === trimmedEmail && u.password === password);
    if (u) { setError(""); onLogin(u); }
    else setError("Invalid email or password. Try again.");
  }

  const inputStyle = {
    width: "100%", marginTop: 6, padding: "10px 14px",
    border: "1.5px solid #e8ddd5", borderRadius: 10,
    fontSize: 16,
    outline: "none", boxSizing: "border-box", fontFamily: "inherit",
    WebkitAppearance: "none", appearance: "none",
    touchAction: "manipulation",
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #faf7f3 0%, #fde8d8 100%)", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitBoxAlign: "center", WebkitBoxPack: "center", flexDirection: "column", alignItems: "center", justifyContent: "center", display: "flex", fontFamily: '-apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}>
      <div className="login-card" style={{ background: "#fff", borderRadius: 20, padding: "48px 44px", width: 380, boxShadow: "0 8px 40px rgba(196,112,74,0.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌊</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#c4704a" }}>SALTYSQUAD</div>
          <div style={{ fontSize: 13, color: "#9a8a7a", marginTop: 4 }}>Team Dashboard · Sign In</div>
        </div>
        <form onSubmit={handleLogin} noValidate>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#7a6a5a", textTransform: "uppercase", letterSpacing: 0.5 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@saltycustoms.com"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              spellCheck="false"
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#7a6a5a", textTransform: "uppercase", letterSpacing: 0.5 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={inputStyle}
            />
          </div>
          {error && <div style={{ color: "#e74c3c", fontSize: 13, marginBottom: 8 }}>{error}</div>}
          <button
            type="submit"
            style={{ width: "100%", background: "#c4704a", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 16, transition: "background 0.15s", touchAction: "manipulation", WebkitAppearance: "none", appearance: "none", minHeight: 48 }}
          >
            Sign In →
          </button>
        </form>
        <div style={{ marginTop: 20, background: "#faf7f3", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#9a8a7a" }}>
          <strong style={{ color: "#7a6a5a" }}>Login with your company email</strong><br />
          Admin: king@saltycustoms.com<br />
          Supervisor: wilson@saltycustoms.com<br />
          Staff: adamo@saltycustoms.com
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD PAGE ────────────────────────────────────────────────────────────

const SF_PRO = '-apple-system, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif';

function DashboardPage({ currentUser, users, leaveRequests, checklists, sales, isAdmin, setPage, onLeaveAction }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIdx = now.getMonth();
  const currentMonthName = MONTHS[currentMonthIdx];
  const monthKey = `${currentYear}-${String(currentMonthIdx + 1).padStart(2, "0")}`;
  const myChecklist = checklists[currentUser.id]?.[monthKey];
  const myScore = myChecklist ? pct(myChecklist.checks) : null;
  const pendingLeave = leaveRequests.filter(l => l.status === "Pending" && (isAdmin || l.userId === currentUser.id));
  const staffList = users.filter(u => u.role !== "admin");

  // ── Sales calculations ──
  const currentSales = sales.find(s => s.month === currentMonthName && s.year === currentYear);
  const monthTarget = currentSales?.target || 500000;
  const currentAchieved = currentSales?.achieved || 0;
  const currentRemaining = Math.max(0, monthTarget - currentAchieved);
  const currentPct = monthTarget > 0 ? Math.min(Math.round((currentAchieved / monthTarget) * 100), 100) : 0;
  const hitTarget = currentAchieved >= monthTarget && currentAchieved > 0;
  const salesColor = currentPct >= 90 ? "#27ae60" : currentPct >= 50 ? "#f39c12" : "#e74c3c";
  const salesBg   = currentPct >= 90 ? "#eafaf1" : currentPct >= 50 ? "#fff8e6" : "#fdf0f0";

  // ── Year-to-date ──
  const ytdRows = sales.filter(s => {
    const mIdx = MONTHS.indexOf(s.month);
    return s.year === currentYear && mIdx <= currentMonthIdx;
  });
  const ytdTarget   = ytdRows.reduce((sum, s) => sum + s.target, 0);
  const ytdAchieved = ytdRows.reduce((sum, s) => sum + s.achieved, 0);
  const ytdPct      = ytdTarget > 0 ? Math.min(Math.round((ytdAchieved / ytdTarget) * 100), 100) : 0;
  const ytdColor    = ytdPct >= 90 ? "#27ae60" : ytdPct >= 50 ? "#f39c12" : "#e74c3c";
  const ytdHit      = ytdRows.filter(s => s.achieved >= s.target && s.achieved > 0).length;
  const ytdMissed   = ytdRows.filter((s, i) => {
    const mIdx = MONTHS.indexOf(s.month);
    return mIdx < currentMonthIdx && s.achieved < s.target;
  }).length;

  // ── All 12 months for breakdown table ──
  const allMonths = MONTHS.map((m, i) => {
    const row     = sales.find(s => s.month === m && s.year === currentYear);
    const isPast  = i < currentMonthIdx;
    const isCurr  = i === currentMonthIdx;
    const isFuture = i > currentMonthIdx;
    const target   = row?.target || 500000;
    const achieved = row?.achieved || 0;
    const pctVal   = target > 0 && achieved > 0 ? Math.round((achieved / target) * 100) : 0;
    const hit      = achieved >= target && achieved > 0;
    let statusIcon, statusLabel, statusColor;
    if (isFuture)     { statusIcon = "⏳"; statusLabel = "Upcoming";    statusColor = "#b0a09a"; }
    else if (isCurr)  { statusIcon = "🔄"; statusLabel = "In Progress"; statusColor = "#3498db"; }
    else if (hit)     { statusIcon = "✅"; statusLabel = "Hit";         statusColor = "#27ae60"; }
    else              { statusIcon = "❌"; statusLabel = "Missed";      statusColor = "#e74c3c"; }
    return { m, target, achieved, pctVal, hit, isPast, isCurr, isFuture, statusIcon, statusLabel, statusColor };
  });

  const totalTarget   = allMonths.reduce((sum, r) => sum + r.target, 0);
  const totalAchieved = allMonths.reduce((sum, r) => sum + r.achieved, 0);
  const totalPct      = totalTarget > 0 && totalAchieved > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
  const totalColor    = totalPct >= 90 ? "#27ae60" : totalPct >= 50 ? "#f39c12" : "#e74c3c";

  const SmallCard = ({ title, children, accent, onClick }) => (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 16, padding: "22px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", borderLeft: `4px solid ${accent}`, cursor: onClick ? "pointer" : "default", transition: "transform 0.15s, box-shadow 0.15s" }}
      onMouseEnter={e => { if(onClick) { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.1)"; }}}
      onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.06)"; }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8a7a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div>
      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#3a2a1a", margin: 0, fontFamily: SF_PRO }}>
          Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, {currentUser.name.split(" ")[0]} 👋
        </h1>
        <div style={{ color: "#9a8a7a", fontSize: 14, marginTop: 4 }}>
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          HERO: SALES SECTION
      ══════════════════════════════════════════════════ */}
      <div style={{ marginBottom: 32 }}>

        {/* A) Current Month Hero Card */}
        <div style={{ background: "#fff", borderRadius: 20, padding: "28px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", marginBottom: 16, border: `2px solid ${salesColor}30`, position: "relative", overflow: "hidden" }}>
          {/* Subtle tinted accent strip */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: salesColor, borderRadius: "20px 20px 0 0" }} />

          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 20, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8a7a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                Sales Performance
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a", fontFamily: SF_PRO }}>
                {currentMonthName} {currentYear}
              </div>
              {hitTarget && (
                <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: "#27ae60" }}>
                  🎯 Target Hit! Congratulations!
                </div>
              )}
            </div>

            {/* Big bold percentage */}
            <div style={{ background: salesBg, borderRadius: 20, padding: "16px 28px", textAlign: "center", minWidth: 130 }}>
              <div style={{ fontSize: 58, fontWeight: 800, color: salesColor, lineHeight: 1, fontFamily: SF_PRO, letterSpacing: "-2px" }}>
                {currentPct}<span style={{ fontSize: 26, letterSpacing: 0 }}>%</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9a8a7a", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                achieved
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 22 }}>
            {[
              { label: "Target", value: `RM ${monthTarget.toLocaleString()}`, color: "#3a2a1a" },
              { label: "Achieved", value: `RM ${currentAchieved.toLocaleString()}`, color: salesColor },
              { label: "Remaining", value: currentRemaining > 0 ? `RM ${currentRemaining.toLocaleString()}` : "None 🎉", color: currentRemaining > 0 ? "#e74c3c" : "#27ae60" },
            ].map(stat => (
              <div key={stat.label} style={{ background: "#faf7f3", borderRadius: 12, padding: "14px 16px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9a8a7a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{stat.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, fontFamily: SF_PRO }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "#9a8a7a", fontWeight: 600 }}>Progress to target</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: salesColor }}>{currentPct}%</span>
            </div>
            <div style={{ background: "#ede8e3", borderRadius: 99, height: 12, overflow: "hidden" }}>
              <div style={{ width: `${currentPct}%`, height: "100%", background: salesColor, borderRadius: 99, transition: "width 0.6s ease" }} />
            </div>
          </div>
        </div>

        {/* B) Year-to-Date Summary */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8a7a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
            Year-to-Date Summary — {currentYear}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 16, marginBottom: 16 }}>
            {[
              { label: "Total Target",   value: `RM ${ytdTarget.toLocaleString()}`,   color: "#3a2a1a" },
              { label: "Total Achieved", value: `RM ${ytdAchieved.toLocaleString()}`, color: ytdColor },
              { label: "Overall %",      value: `${ytdPct}%`,                          color: ytdColor },
              { label: "Months Hit",     value: `${ytdHit} hit`,                       color: "#27ae60",
                sub: ytdMissed > 0 ? `${ytdMissed} missed` : null },
            ].map(stat => (
              <div key={stat.label}>
                <div style={{ fontSize: 11, color: "#9a8a7a", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: stat.color, fontFamily: SF_PRO }}>{stat.value}</div>
                {stat.sub && <div style={{ fontSize: 12, color: "#e74c3c", marginTop: 2 }}>{stat.sub}</div>}
              </div>
            ))}
          </div>
          <div style={{ background: "#ede8e3", borderRadius: 99, height: 8, overflow: "hidden" }}>
            <div style={{ width: `${ytdPct}%`, height: "100%", background: ytdColor, borderRadius: 99, transition: "width 0.6s ease" }} />
          </div>
        </div>

        {/* C) Monthly Breakdown Table */}
        <div style={{ background: "#fff", borderRadius: 16, padding: "20px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8a7a", textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>
            Monthly Breakdown — {currentYear}
          </div>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f0ebe4" }}>
                  {["Month", "Target", "Achieved", "%", "Status"].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 0 ? "left" : i === 4 ? "center" : "right", padding: "8px 12px", color: "#9a8a7a", fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: SF_PRO }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allMonths.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f8f5f2", background: r.isCurr ? "#fffbf5" : "transparent", opacity: r.isFuture ? 0.55 : 1 }}>
                    <td style={{ padding: "11px 12px", fontWeight: r.isCurr ? 700 : 400, color: r.isCurr ? "#c4704a" : "#3a2a1a" }}>
                      {r.m}
                      {r.isCurr && <span style={{ fontSize: 10, background: "#fde8d8", color: "#c4704a", borderRadius: 99, padding: "1px 6px", marginLeft: 6, fontWeight: 700 }}>NOW</span>}
                    </td>
                    <td style={{ padding: "11px 12px", textAlign: "right", color: "#3a2a1a" }}>
                      RM {r.target.toLocaleString()}
                    </td>
                    <td style={{ padding: "11px 12px", textAlign: "right", fontWeight: r.achieved > 0 ? 600 : 400, color: r.isFuture ? "#b0a09a" : r.hit ? "#27ae60" : r.achieved > 0 ? "#e74c3c" : "#b0a09a" }}>
                      {r.isFuture ? "—" : `RM ${r.achieved.toLocaleString()}`}
                    </td>
                    <td style={{ padding: "11px 12px", textAlign: "right", fontWeight: 700, color: r.isFuture ? "#b0a09a" : r.pctVal >= 90 ? "#27ae60" : r.pctVal >= 50 ? "#f39c12" : r.pctVal > 0 ? "#e74c3c" : "#b0a09a" }}>
                      {r.isFuture || r.pctVal === 0 ? "—" : `${r.pctVal}%`}
                    </td>
                    <td style={{ padding: "11px 12px", textAlign: "center", color: r.statusColor, fontWeight: 600, fontSize: 13 }}>
                      {r.statusIcon} {r.statusLabel}
                    </td>
                  </tr>
                ))}
                {/* TOTAL row */}
                <tr style={{ borderTop: "2px solid #f0ebe4", background: "#faf7f3" }}>
                  <td style={{ padding: "12px 12px", fontWeight: 700, color: "#3a2a1a", fontFamily: SF_PRO }}>TOTAL</td>
                  <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, color: "#3a2a1a" }}>RM {totalTarget.toLocaleString()}</td>
                  <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, color: totalColor }}>RM {totalAchieved.toLocaleString()}</td>
                  <td style={{ padding: "12px 12px", textAlign: "right", fontWeight: 700, color: totalColor }}>{totalPct > 0 ? `${totalPct}%` : "—"}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          REST OF DASHBOARD
      ══════════════════════════════════════════════════ */}

      {/* Leave + Integrity cards */}
      <div className="cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 28 }}>
        <SmallCard title="Annual Leave Left" accent="#c4704a" onClick={() => setPage("leave")}>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#c4704a", fontFamily: SF_PRO }}>{currentUser.annualLeft}<span style={{ fontSize: 16, color: "#9a8a7a", fontWeight: 400 }}> days</span></div>
          <Bar value={currentUser.annualLeft} max={12} color="#c4704a" />
        </SmallCard>
        <SmallCard title={`Integrity Score — ${MONTHS[now.getMonth()]}`} accent="#7ab8a0" onClick={() => setPage("checklist")}>
          {myScore !== null
            ? <><div style={{ fontSize: 36, fontWeight: 800, color: "#7ab8a0", fontFamily: SF_PRO }}>{myScore}<span style={{ fontSize: 16 }}>%</span></div><Bar value={myScore} max={100} color="#7ab8a0" /></>
            : <div style={{ fontSize: 14, color: "#9a8a7a" }}>Not submitted yet<br /><span style={{ color: "#c4704a", fontWeight: 600, fontSize: 13 }}>→ Complete checklist</span></div>}
        </SmallCard>
      </div>

      {/* Pending leave requests */}
      {pendingLeave.length > 0 && (
        <div style={{ background: "#fffbf5", border: "1.5px solid #fde8d8", borderRadius: 14, padding: "18px 22px", marginBottom: 22 }}>
          <div style={{ fontWeight: 700, color: "#c4704a", marginBottom: 12 }}>⏳ Pending Leave Requests {isAdmin && `(${pendingLeave.length})`}</div>
          {pendingLeave.map(l => {
            const u = users.find(u => u.id === l.userId);
            return (
              <div key={l.id} className="pending-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f0ebe4" }}>
                <div>
                  {isAdmin && <span style={{ fontWeight: 600, color: "#5a4a3a" }}>{u?.name} · </span>}
                  <span style={{ color: "#7a6a5a" }}>{l.type} Leave · {l.days} day{l.days > 1 ? "s" : ""}</span>
                  <span style={{ color: "#9a8a7a", fontSize: 12 }}> · {l.from} to {l.to}</span>
                </div>
                {isAdmin ? (
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={() => onLeaveAction(l.id, "Approved")} style={{ background: "#2ecc71", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✓ Approve</button>
                    <button type="button" onClick={() => onLeaveAction(l.id, "Rejected")} style={{ background: "#e74c3c", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✕ Reject</button>
                  </div>
                ) : (
                  <span style={{ background: "#fff4e0", color: "#f39c12", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>Pending</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Admin: team integrity overview */}
      {isAdmin && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "22px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, color: "#3a2a1a", marginBottom: 16, fontSize: 15 }}>👥 Team Integrity Overview — {MONTHS[now.getMonth()]} {now.getFullYear()}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            {staffList.map(u => {
              const cl = checklists[u.id]?.[monthKey];
              const score = cl ? pct(cl.checks) : null;
              return (
                <div key={u.id} style={{ background: "#faf7f3", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#c4704a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{u.avatar}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#3a2a1a" }}>{u.name}</div>
                  </div>
                  {score !== null
                    ? <><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: "#7a6a5a" }}>Score</span><span style={{ fontSize: 12, fontWeight: 700, color: score >= 80 ? "#2ecc71" : score >= 60 ? "#f39c12" : "#e74c3c" }}>{score}%</span></div><Bar value={score} max={100} color={score >= 80 ? "#2ecc71" : score >= 60 ? "#f39c12" : "#e74c3c"} /></>
                    : <div style={{ fontSize: 12, color: "#b0a09a" }}>Not submitted</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── LEAVE PAGE ────────────────────────────────────────────────────────────────

function LeavePage({ currentUser, users, setUsers, leaveRequests, setLeaveRequests, isAdmin, onLeaveAction }) {
  const [tab, setTab] = useState("apply");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ type: "Annual", from: today, to: today, reason: "" });
  const [msg, setMsg] = useState("");

  // Admin: record leave for staff
  const nonAdminUsers = users.filter(u => u.role !== "admin");
  const [recordForm, setRecordForm] = useState({ userId: "", type: "Annual", from: today, to: today, reason: "", approveNow: false });
  const [recordMsg, setRecordMsg] = useState("");

  // Admin: edit existing leave
  const [editingLeave, setEditingLeave] = useState(null);
  const [editLeaveVals, setEditLeaveVals] = useState({});

  function calcDays(from, to) {
    if (!from || !to) return 0;
    const d1 = new Date(from), d2 = new Date(to);
    return Math.max(0, Math.round((d2 - d1) / 86400000) + 1);
  }

  async function handleApply() {
    const days = calcDays(form.from, form.to);
    if (!form.from || !form.to || !form.reason) { setMsg("Please fill in all fields."); return; }
    if (days <= 0) { setMsg("End date must be on or after start date."); return; }
    const bal = currentUser.annualLeft;
    if (days > bal) { setMsg(`Insufficient annual leave balance (${bal} days left).`); return; }

    const { data, error } = await supabase
      .from("leave_requests")
      .insert({ user_id: currentUser.id, type: form.type, from_date: form.from, to_date: form.to, days, reason: form.reason, status: "Pending" })
      .select().single();

    if (error) { setMsg("❌ Failed to submit. Please try again."); return; }
    setLeaveRequests(prev => [...prev, mapLeave(data)]);
    setMsg("✅ Leave application submitted successfully!");
    setForm({ type: "Annual", from: today, to: today, reason: "" });
  }

  async function handleRecord() {
    const uid = Number(recordForm.userId) || nonAdminUsers[0]?.id;
    if (!uid || !recordForm.from || !recordForm.to || !recordForm.reason) { setRecordMsg("Please fill in all fields."); return; }
    const days = calcDays(recordForm.from, recordForm.to);
    if (days <= 0) { setRecordMsg("End date must be on or after start date."); return; }
    const targetUser = users.find(u => u.id === uid);
    const status = recordForm.approveNow ? "Approved" : "Pending";

    const { data, error } = await supabase
      .from("leave_requests")
      .insert({ user_id: uid, type: recordForm.type, from_date: recordForm.from, to_date: recordForm.to, days, reason: recordForm.reason, status })
      .select().single();

    if (error) { setRecordMsg("❌ Failed to record leave."); return; }
    setLeaveRequests(prev => [...prev, mapLeave(data)]);

    if (recordForm.approveNow && targetUser) {
      const newBalance = Math.max(0, targetUser.annualLeft - days);
      const { error: balErr } = await supabase.from("users").update({ annual_left: newBalance }).eq("id", uid);
      if (!balErr) setUsers(prev => prev.map(u => u.id !== uid ? u : { ...u, annualLeft: newBalance }));
    }

    setRecordMsg(`✅ Leave recorded for ${targetUser?.name || "staff"}!`);
    setRecordForm(prev => ({ ...prev, from: today, to: today, reason: "", approveNow: false }));
  }

  function startEditLeave(l) {
    setEditingLeave(l.id);
    setEditLeaveVals({ type: l.type, from: l.from, to: l.to, reason: l.reason, status: l.status });
  }

  async function handleSaveEditLeave(l) {
    const days = calcDays(editLeaveVals.from, editLeaveVals.to);
    if (days <= 0) return;
    const { error } = await supabase.from("leave_requests").update({
      type: editLeaveVals.type, from_date: editLeaveVals.from, to_date: editLeaveVals.to,
      days, reason: editLeaveVals.reason, status: editLeaveVals.status,
    }).eq("id", l.id);
    if (!error) {
      setLeaveRequests(prev => prev.map(r => r.id !== l.id ? r : {
        ...r, type: editLeaveVals.type, from: editLeaveVals.from, to: editLeaveVals.to,
        days, reason: editLeaveVals.reason, status: editLeaveVals.status,
      }));
      if (editLeaveVals.status === "Approved" && l.status !== "Approved") {
        const targetUser = users.find(u => u.id === l.userId);
        if (targetUser) {
          const newBalance = Math.max(0, targetUser.annualLeft - days);
          const { error: balErr } = await supabase.from("users").update({ annual_left: newBalance }).eq("id", l.userId);
          if (!balErr) setUsers(prev => prev.map(u => u.id !== l.userId ? u : { ...u, annualLeft: newBalance }));
        }
      }
    }
    setEditingLeave(null);
  }

  async function handleDeleteLeave(id) {
    if (!window.confirm("Delete this leave request? This cannot be undone.")) return;
    const { error } = await supabase.from("leave_requests").delete().eq("id", id);
    if (!error) setLeaveRequests(prev => prev.filter(r => r.id !== id));
  }

  const myRequests = leaveRequests.filter(l => l.userId === currentUser.id);
  const allRequests = leaveRequests;
  const days = calcDays(form.from, form.to);
  const recordDays = calcDays(recordForm.from, recordForm.to);

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{ background: tab === id ? "#c4704a" : "#fff", color: tab === id ? "#fff" : "#7a6a5a", border: "1.5px solid " + (tab === id ? "#c4704a" : "#e8ddd5"), borderRadius: 8, padding: "7px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{label}</button>
  );

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a", marginBottom: 8 }}>🌴 Leave Management</h2>
      <div className="leave-balance-row" style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fde8d8", borderRadius: 12, padding: "14px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#c4704a" }}>{currentUser.annualLeft}</div>
          <div style={{ fontSize: 12, color: "#7a6a5a" }}>Annual Days Left</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <TabBtn id="apply" label="Apply for Leave" />
        <TabBtn id="history" label="My History" />
        {isAdmin && <TabBtn id="all" label="All Requests" />}
        {isAdmin && <TabBtn id="record" label="Record for Staff" />}
      </div>

      {tab === "apply" && (
        <div className="leave-form" style={{ background: "#fff", borderRadius: 16, padding: "28px", maxWidth: 500, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={labelStyle}>Leave Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={inputStyle}>
                <option>Annual</option>
              </select>
            </div>
            <div className="date-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>From</label>
                <input type="date" value={form.from} onChange={e => setForm({...form, from: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>To</label>
                <input type="date" value={form.to} onChange={e => setForm({...form, to: e.target.value})} style={inputStyle} />
              </div>
            </div>
            {days > 0 && <div style={{ background: "#fde8d8", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#c4704a", fontWeight: 600 }}>📅 {days} day{days > 1 ? "s" : ""} selected</div>}
            <div>
              <label style={labelStyle}>Reason</label>
              <textarea value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} rows={3} placeholder="Brief reason for leave..." style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            {msg && <div style={{ color: msg.startsWith("✅") ? "#2ecc71" : "#e74c3c", fontSize: 13 }}>{msg}</div>}
            <button onClick={handleApply} style={{ background: "#c4704a", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Submit Application</button>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div>
          {myRequests.length === 0 ? <div style={{ color: "#9a8a7a", fontSize: 14 }}>No leave applications yet.</div> : (
            myRequests.map(l => <LeaveCard key={l.id} l={l} users={users} showUser={false} />)
          )}
        </div>
      )}

      {tab === "all" && isAdmin && (
        <div>
          {allRequests.length === 0 ? <div style={{ color: "#9a8a7a", fontSize: 14 }}>No applications yet.</div> : (
            allRequests.map(l =>
              editingLeave === l.id ? (
                <div key={l.id} style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", marginBottom: 10, boxShadow: "0 2px 10px rgba(0,0,0,0.08)", border: "1.5px solid #c4704a" }}>
                  <div style={{ fontWeight: 700, color: "#c4704a", marginBottom: 14, fontSize: 14 }}>Edit Leave — {users.find(u => u.id === l.userId)?.name}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select value={editLeaveVals.type} onChange={e => setEditLeaveVals({...editLeaveVals, type: e.target.value})} style={inputStyle}>
                        <option>Annual</option><option>Sick</option><option>Unpaid</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select value={editLeaveVals.status} onChange={e => setEditLeaveVals({...editLeaveVals, status: e.target.value})} style={inputStyle}>
                        <option>Pending</option><option>Approved</option><option>Rejected</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>From</label>
                      <input type="date" value={editLeaveVals.from} onChange={e => setEditLeaveVals({...editLeaveVals, from: e.target.value})} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>To</label>
                      <input type="date" value={editLeaveVals.to} onChange={e => setEditLeaveVals({...editLeaveVals, to: e.target.value})} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={labelStyle}>Reason</label>
                    <textarea value={editLeaveVals.reason} onChange={e => setEditLeaveVals({...editLeaveVals, reason: e.target.value})} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => handleSaveEditLeave(l)} style={{ background: "#c4704a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Save Changes</button>
                    <button onClick={() => setEditingLeave(null)} style={{ background: "#f0ebe4", color: "#7a6a5a", border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <LeaveCard key={l.id} l={l} users={users} showUser={true} isAdmin={isAdmin} onAction={onLeaveAction}
                  onEdit={() => startEditLeave(l)} onDelete={() => handleDeleteLeave(l.id)} />
              )
            )
          )}
        </div>
      )}

      {tab === "record" && isAdmin && (
        <div className="leave-form" style={{ background: "#fff", borderRadius: 16, padding: "28px", maxWidth: 500, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 700, color: "#3a2a1a", marginBottom: 16, fontSize: 15 }}>Record Leave on Behalf of Staff</div>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={labelStyle}>Staff Member</label>
              <select value={recordForm.userId || nonAdminUsers[0]?.id} onChange={e => setRecordForm({...recordForm, userId: Number(e.target.value)})} style={inputStyle}>
                {nonAdminUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.title})</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Leave Type</label>
              <select value={recordForm.type} onChange={e => setRecordForm({...recordForm, type: e.target.value})} style={inputStyle}>
                <option>Annual</option><option>Sick</option><option>Unpaid</option>
              </select>
            </div>
            <div className="date-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>From</label>
                <input type="date" value={recordForm.from} onChange={e => setRecordForm({...recordForm, from: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>To</label>
                <input type="date" value={recordForm.to} onChange={e => setRecordForm({...recordForm, to: e.target.value})} style={inputStyle} />
              </div>
            </div>
            {recordDays > 0 && <div style={{ background: "#fde8d8", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#c4704a", fontWeight: 600 }}>📅 {recordDays} day{recordDays > 1 ? "s" : ""} selected</div>}
            <div>
              <label style={labelStyle}>Reason</label>
              <textarea value={recordForm.reason} onChange={e => setRecordForm({...recordForm, reason: e.target.value})} rows={3} placeholder="Brief reason..." style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#3a2a1a" }}>
              <input type="checkbox" checked={recordForm.approveNow} onChange={e => setRecordForm({...recordForm, approveNow: e.target.checked})} style={{ width: 16, height: 16, cursor: "pointer" }} />
              Approve immediately (deducts from annual balance)
            </label>
            {recordMsg && <div style={{ color: recordMsg.startsWith("✅") ? "#2ecc71" : "#e74c3c", fontSize: 13 }}>{recordMsg}</div>}
            <button onClick={handleRecord} style={{ background: "#c4704a", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Record Leave</button>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaveCard({ l, users, showUser, isAdmin, onAction, onEdit, onDelete }) {
  const u = users.find(u => u.id === l.userId);
  return (
    <div className="leave-card" style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", marginBottom: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `4px solid ${statusColor(l.status)}` }}>
      <div>
        {showUser && <div style={{ fontWeight: 700, color: "#3a2a1a", marginBottom: 2 }}>{u?.name}</div>}
        <div style={{ fontSize: 13, color: "#5a4a3a" }}><strong>{l.type}</strong> · {l.days} day{l.days > 1 ? "s" : ""} · {l.from} → {l.to}</div>
        <div style={{ fontSize: 12, color: "#9a8a7a", marginTop: 2 }}>{l.reason}</div>
      </div>
      <div className="leave-card-actions" style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ background: l.status === "Approved" ? "#eafaf1" : l.status === "Rejected" ? "#fdf0f0" : "#fff4e0", color: statusColor(l.status), fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99 }}>{l.status}</span>
        {isAdmin && l.status === "Pending" && (
          <>
            <button type="button" onClick={() => onAction(l.id, "Approved")} style={{ background: "#2ecc71", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>✓ Approve</button>
            <button type="button" onClick={() => onAction(l.id, "Rejected")} style={{ background: "#e74c3c", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>✕ Reject</button>
          </>
        )}
        {isAdmin && onEdit && (
          <button type="button" onClick={onEdit} style={{ background: "#f0ebe4", color: "#7a6a5a", border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>✏️</button>
        )}
        {isAdmin && onDelete && (
          <button type="button" onClick={onDelete} style={{ background: "#fdf0f0", color: "#e74c3c", border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>🗑</button>
        )}
      </div>
    </div>
  );
}

// ── CHECKLIST PAGE ────────────────────────────────────────────────────────────

function ChecklistPage({ currentUser, users, checklists, setChecklists, isAdmin }) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const [selectedUser, setSelectedUser] = useState(currentUser.id);
  const [selectedMonth, setSelectedMonth] = useState(monthKey);
  const [tab, setTab] = useState("fill");

  const viewUserId = isAdmin ? selectedUser : currentUser.id;
  const cl = checklists[viewUserId]?.[selectedMonth] || { checks: {}, remarks: "" };
  const isCurrentUserMonth = viewUserId === currentUser.id && selectedMonth === monthKey;
  const canEdit = isAdmin || isCurrentUserMonth;

  // Ref always points to latest checklists — prevents stale closure in async functions
  const checklistsRef = useRef(checklists);
  checklistsRef.current = checklists;

  // Local remarks state to avoid a DB write on every keystroke
  const [localRemarks, setLocalRemarks] = useState(cl.remarks || "");
  useEffect(() => { setLocalRemarks(cl.remarks || ""); }, [viewUserId, selectedMonth, cl.remarks]);

  // Save & Submit state
  const [saveStatus, setSaveStatus] = useState(null); // null | "saving" | "saved" | "error"
  const [lastSaved, setLastSaved] = useState(null);   // time string from last in-session save
  // Reset save status whenever user or month changes
  useEffect(() => { setSaveStatus(null); setLastSaved(null); }, [viewUserId, selectedMonth]);

  function toggle(id) {
    if (!canEdit) return;
    // Compute newChecks from current state — pure, no side-effects in updater
    const currentChecks = cl.checks || {};
    const newChecks = { ...currentChecks, [id]: !currentChecks[id] };
    setChecklists(prev => ({
      ...prev,
      [viewUserId]: {
        ...(prev[viewUserId] || {}),
        [selectedMonth]: { ...(prev[viewUserId]?.[selectedMonth] || { checks: {}, remarks: "" }), checks: newChecks },
      },
    }));
    // Save to Supabase in the background — no state update on complete
    supabase
      .from("checklist_submissions")
      .upsert(
        { user_id: viewUserId, month_key: selectedMonth, checks: newChecks, remarks: cl.remarks || "" },
        { onConflict: "user_id,month_key" }
      )
      .then(({ error }) => {
        if (error) console.error("[toggle] Supabase save error:", error);
      });
  }

  async function saveRemarks() {
    if (localRemarks === (cl.remarks || "")) return;
    // Read latest checks from ref to avoid overwriting optimistic checkbox updates
    const latestChecks = checklistsRef.current[viewUserId]?.[selectedMonth]?.checks || {};
    await supabase
      .from("checklist_submissions")
      .upsert(
        { user_id: viewUserId, month_key: selectedMonth, checks: latestChecks, remarks: localRemarks },
        { onConflict: "user_id,month_key" }
      );
    // Use functional update so we never overwrite concurrent checkbox toggles
    setChecklists(prev => ({
      ...prev,
      [viewUserId]: {
        ...(prev[viewUserId] || {}),
        [selectedMonth]: { ...(prev[viewUserId]?.[selectedMonth] || { checks: {}, remarks: "" }), remarks: localRemarks },
      },
    }));
  }

  async function handleSaveSubmit() {
    setSaveStatus("saving");
    const latestChecks = checklistsRef.current[viewUserId]?.[selectedMonth]?.checks || {};
    const { error } = await supabase
      .from("checklist_submissions")
      .upsert(
        { user_id: viewUserId, month_key: selectedMonth, checks: latestChecks, remarks: localRemarks },
        { onConflict: "user_id,month_key" }
      );
    if (error) {
      console.error("[handleSaveSubmit] error:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }
    // Persist remarks into shared state so score card reflects them too
    setChecklists(prev => ({
      ...prev,
      [viewUserId]: {
        ...(prev[viewUserId] || {}),
        [selectedMonth]: { ...(prev[viewUserId]?.[selectedMonth] || { checks: {}, remarks: "" }), checks: latestChecks, remarks: localRemarks },
      },
    }));
    const t = new Date();
    setLastSaved(t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus(null), 4000);
  }

  // Build month options (12 for admin, 6 for staff)
  const monthOptions = [];
  const maxMonths = isAdmin ? 12 : 6;
  for (let i = 0; i < maxMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    monthOptions.push({ key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }

  const score = scoreOf(cl.checks);
  const staffList = users.filter(u => u.role !== "admin");

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a", marginBottom: 6 }}>✅ Professional Integrity Checklist</h2>
      <p style={{ color: "#9a8a7a", fontSize: 13, marginBottom: 20 }}>Monthly self-assessment. Check each item you've fulfilled this month.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab("fill")} style={{ background: tab==="fill"?"#c4704a":"#fff", color: tab==="fill"?"#fff":"#7a6a5a", border:"1.5px solid "+(tab==="fill"?"#c4704a":"#e8ddd5"), borderRadius:8, padding:"7px 18px", cursor:"pointer", fontSize:13, fontWeight:600 }}>My Checklist</button>
        {isAdmin && <button onClick={() => setTab("overview")} style={{ background: tab==="overview"?"#c4704a":"#fff", color: tab==="overview"?"#fff":"#7a6a5a", border:"1.5px solid "+(tab==="overview"?"#c4704a":"#e8ddd5"), borderRadius:8, padding:"7px 18px", cursor:"pointer", fontSize:13, fontWeight:600 }}>Bird's Eye View</button>}
      </div>

      {tab === "fill" && (
        <div className="checklist-layout" style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {isAdmin && (
                <select value={selectedUser} onChange={e => setSelectedUser(Number(e.target.value))} style={{ ...inputStyle, width: "auto" }}>
                  {staffList.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
              <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
                {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
              {!canEdit && <span style={{ fontSize: 12, color: "#9a8a7a", alignSelf: "center" }}>👁 View only</span>}
              {isAdmin && viewUserId !== currentUser.id && <span style={{ fontSize: 12, background: "#fde8d8", color: "#c4704a", padding: "3px 8px", borderRadius: 6, fontWeight: 600, alignSelf: "center" }}>Admin editing</span>}
            </div>

            {CHECKLIST_SECTIONS.map(section => (
              <div key={section.id} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <div style={{ fontWeight: 700, color: "#5a4a3a", fontSize: 14, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #f0ebe4" }}>{section.label}</div>
                {section.items.map(item => (
                  <div key={item.id} className="checklist-item" onClick={() => toggle(item.id)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 6px", borderRadius: 8, cursor: canEdit ? "pointer" : "default", transition: "background 0.1s" }}
                    onMouseEnter={e => { if(canEdit) e.currentTarget.style.background="#faf7f3"; }}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <div className="check-box" style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${cl.checks[item.id] ? "#c4704a" : "#d0c5bc"}`, background: cl.checks[item.id] ? "#c4704a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.15s" }}>
                      {cl.checks[item.id] && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 13, color: cl.checks[item.id] ? "#3a2a1a" : "#7a6a5a", lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
              <div style={{ fontWeight: 700, color: "#5a4a3a", fontSize: 14, marginBottom: 10 }}>📝 Remarks</div>
              <textarea
                value={localRemarks}
                onChange={e => setLocalRemarks(e.target.value)}
                onBlur={saveRemarks}
                readOnly={!canEdit}
                rows={3}
                placeholder={canEdit ? "Add your self-assessment remarks here..." : "No remarks added."}
                style={{ ...inputStyle, resize: "vertical", width: "100%", boxSizing: "border-box" }}
              />
            </div>

            {canEdit && (() => {
              const monthLabel = monthOptions.find(m => m.key === selectedMonth)?.label || selectedMonth;
              const staffName = users.find(u => u.id === viewUserId)?.name;
              const isAdminOnBehalf = isAdmin && viewUserId !== currentUser.id;
              const successMsg = isAdminOnBehalf
                ? `✅ Saved for ${staffName} — ${monthLabel}`
                : `✅ Checklist saved for ${monthLabel}!`;
              return (
                <div style={{ marginTop: 8 }}>
                  <button
                    onClick={handleSaveSubmit}
                    disabled={score === 0 || saveStatus === "saving"}
                    style={{
                      width: "100%", padding: "13px 20px", borderRadius: 12, border: "none", cursor: score === 0 || saveStatus === "saving" ? "not-allowed" : "pointer",
                      background: score === 0 ? "#ede8e3" : saveStatus === "saved" ? "#2ecc71" : saveStatus === "error" ? "#e74c3c" : "#c4704a",
                      color: score === 0 ? "#b0a09a" : "#fff", fontSize: 15, fontWeight: 700,
                      transition: "background 0.2s, transform 0.1s",
                      boxShadow: score > 0 && saveStatus !== "saving" ? "0 3px 12px rgba(196,112,74,0.3)" : "none",
                    }}
                    onMouseEnter={e => { if (score > 0 && saveStatus !== "saving") e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}
                  >
                    {saveStatus === "saving" ? "Saving…"
                      : saveStatus === "saved" ? successMsg
                      : saveStatus === "error" ? "⚠️ Save failed — try again"
                      : score === 0 ? "Tick at least one item to save"
                      : "💾 Save & Submit"}
                  </button>
                  {(lastSaved || checklists[viewUserId]?.[selectedMonth]) && saveStatus !== "saved" && (
                    <div style={{ textAlign: "center", fontSize: 12, color: "#9a8a7a", marginTop: 8 }}>
                      {lastSaved ? `Last saved: ${lastSaved}` : "Previously submitted — changes save instantly"}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Score card */}
          <div className="score-card-sticky" style={{ position: "sticky", top: 80 }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8a7a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 16 }}>Monthly Score</div>
              <div style={{ fontSize: 56, fontWeight: 800, color: score/TOTAL_ITEMS >= 0.8 ? "#2ecc71" : score/TOTAL_ITEMS >= 0.6 ? "#f39c12" : "#e74c3c", lineHeight: 1 }}>{score}</div>
              <div style={{ color: "#9a8a7a", fontSize: 14, marginBottom: 16 }}>out of {TOTAL_ITEMS}</div>
              <div style={{ background: "#ede8e3", borderRadius: 99, height: 10, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${pct(cl.checks)}%`, height: "100%", background: pct(cl.checks) >= 80 ? "#2ecc71" : pct(cl.checks) >= 60 ? "#f39c12" : "#e74c3c", borderRadius: 99, transition: "width 0.4s" }} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a" }}>{pct(cl.checks)}%</div>

              {/* Historical scores */}
              <div style={{ marginTop: 20, textAlign: "left" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#9a8a7a", textTransform: "uppercase", marginBottom: 10 }}>History</div>
                {monthOptions.slice(0,4).map(m => {
                  const past = checklists[viewUserId]?.[m.key];
                  const p = past ? pct(past.checks) : null;
                  return (
                    <div key={m.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: "#7a6a5a" }}>{m.label}</span>
                      {p !== null ? <span style={{ fontSize: 12, fontWeight: 700, color: p>=80?"#2ecc71":p>=60?"#f39c12":"#e74c3c" }}>{p}%</span> : <span style={{ fontSize: 11, color: "#c0b5ae" }}>—</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "overview" && isAdmin && (
        <div>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#3a2a1a", marginBottom: 20 }}>Month-on-Month Integrity Scores</div>
            <div className="table-scroll">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 12px", color: "#9a8a7a", fontWeight: 700, borderBottom: "2px solid #f0ebe4" }}>Staff Member</th>
                  {monthOptions.slice(0,5).reverse().map(m => (
                    <th key={m.key} style={{ textAlign: "center", padding: "8px 12px", color: "#9a8a7a", fontWeight: 700, borderBottom: "2px solid #f0ebe4", minWidth: 80 }}>{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffList.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f8f5f2" }}>
                    <td style={{ padding: "12px 12px", fontWeight: 600, color: "#3a2a1a" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:26, height:26, borderRadius:"50%", background:"#c4704a", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700 }}>{u.avatar}</div>
                        {u.name}
                      </div>
                    </td>
                    {monthOptions.slice(0,5).reverse().map(m => {
                      const c = checklists[u.id]?.[m.key];
                      const p = c ? pct(c.checks) : null;
                      return (
                        <td key={m.key} style={{ textAlign: "center", padding: "12px" }}>
                          {p !== null
                            ? <span style={{ background: p>=80?"#eafaf1":p>=60?"#fff4e0":"#fdf0f0", color: p>=80?"#27ae60":p>=60?"#f39c12":"#e74c3c", fontWeight: 700, fontSize: 13, padding: "4px 10px", borderRadius: 8 }}>{p}%</span>
                            : <span style={{ color: "#c0b5ae" }}>—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SALES PAGE ────────────────────────────────────────────────────────────────

const MONTH_ORDER = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function SalesPage({ sales, setSales, isAdmin }) {
  console.log("[SalesPage] rendering — raw sales prop length:", sales.length, sales);

  const [editing, setEditing] = useState(null);
  const [editVals, setEditVals] = useState({});

  // Pick the right year: prefer current year, fall back to the latest year in data
  const currentYear = new Date().getFullYear();
  const yearsInData = [...new Set(sales.map(s => s.year))].sort((a, b) => b - a);
  const displayYear = yearsInData.includes(currentYear) ? currentYear : (yearsInData[0] ?? currentYear);
  const yearSales = sales.filter(s => s.year === displayYear);

  // Deduplicate: keep first occurrence of each month, then sort by canonical order
  const seen = new Set();
  const dedupedSales = yearSales
    .filter(s => { if (seen.has(s.month)) return false; seen.add(s.month); return true; })
    .sort((a, b) => MONTH_ORDER.indexOf(a.month) - MONTH_ORDER.indexOf(b.month));

  console.log("[SalesPage] displayYear:", displayYear, "yearsInData:", yearsInData, "rows after filter:", dedupedSales.length);

  function startEdit(month) {
    const idx = dedupedSales.findIndex(s => s.month === month);
    setEditing(month);
    setEditVals({ target: dedupedSales[idx].target, achieved: dedupedSales[idx].achieved });
  }

  async function saveEdit(month) {
    const s = dedupedSales.find(r => r.month === month);
    const newTarget = Number(editVals.target);
    const newAchieved = Number(editVals.achieved);
    const { error } = await supabase
      .from("sales_targets")
      .update({ target: newTarget, achieved: newAchieved })
      .eq("id", s.id);
    if (!error) {
      setSales(prev => prev.map(row => row.id !== s.id ? row : { ...row, target: newTarget, achieved: newAchieved }));
    }
    setEditing(null);
  }

  const maxVal = Math.max(...dedupedSales.map(s => Math.max(s.target, s.achieved)), 1);
  const BAR_HEIGHT = 100;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a", marginBottom: 6 }}>📊 Team Sales Targets</h2>
      <p style={{ color: "#9a8a7a", fontSize: 13, marginBottom: 24 }}>Monthly team sales performance. {isAdmin ? "Click a row to edit targets and achieved scores." : "View-only."}</p>

      {dedupedSales.length === 0 && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "40px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", textAlign: "center", color: "#9a8a7a" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#5a4a3a", marginBottom: 8 }}>No sales data found for {displayYear}</div>
          <div style={{ fontSize: 13 }}>
            {sales.length === 0
              ? "No rows returned from the sales_targets table. Check your Supabase data and RLS policies."
              : `Data exists for years: ${yearsInData.join(", ")} — but none match ${displayYear}.`}
          </div>
        </div>
      )}

      {/* Chart */}
      {dedupedSales.length > 0 && <div style={{ background: "#fff", borderRadius: 16, padding: "20px 16px 16px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#9a8a7a", marginBottom: 12 }}>Visual Overview</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: BAR_HEIGHT + 28, width: "100%" }}>
          {dedupedSales.map(s => {
            const tH = Math.max(2, Math.round((s.target / maxVal) * BAR_HEIGHT));
            const aH = s.achieved > 0 ? Math.max(2, Math.round((s.achieved / maxVal) * BAR_HEIGHT)) : 0;
            const hit = s.achieved >= s.target && s.achieved > 0;
            return (
              <div key={s.month} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: BAR_HEIGHT, width: "100%" }}>
                  <div
                    title={`Target: RM${s.target.toLocaleString()}`}
                    style={{ flex: 1, minWidth: 0, height: tH, background: "#d8cfc8", borderRadius: "3px 3px 0 0" }}
                  />
                  <div
                    title={`Achieved: RM${s.achieved.toLocaleString()}`}
                    style={{ flex: 1, minWidth: 0, height: aH, background: hit ? "#2ecc71" : aH > 0 ? "#c4704a" : "transparent", borderRadius: "3px 3px 0 0" }}
                  />
                </div>
                <div style={{ fontSize: 9, color: "#9a8a7a", fontWeight: 600, marginTop: 4, textAlign: "center", lineHeight: 1 }}>{s.month}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "#9a8a7a" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", width: 10, height: 10, background: "#d8cfc8", borderRadius: 2 }} /> Target</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", width: 10, height: 10, background: "#c4704a", borderRadius: 2 }} /> Achieved</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", width: 10, height: 10, background: "#2ecc71", borderRadius: 2 }} /> Hit Target</span>
        </div>
      </div>}

      {/* Table */}
      {dedupedSales.length > 0 && <div style={{ background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        {dedupedSales.map(s => {
          const achieved_pct = s.target > 0 && s.achieved > 0 ? Math.round((s.achieved / s.target) * 100) : 0;
          const hit = s.achieved >= s.target && s.achieved > 0;
          return (
            <div key={s.month} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid #f8f5f2" }}>
              <div style={{ width: 40, fontSize: 14, fontWeight: 700, color: "#5a4a3a" }}>{s.month}</div>
              {editing === s.month && isAdmin ? (
                <>
                  <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div><label style={{ fontSize: 11, color: "#9a8a7a" }}>Target (RM)</label><input type="number" value={editVals.target} onChange={e => setEditVals({...editVals, target: e.target.value})} style={{ ...inputStyle, padding: "6px 10px" }} /></div>
                    <div><label style={{ fontSize: 11, color: "#9a8a7a" }}>Achieved (RM)</label><input type="number" value={editVals.achieved} onChange={e => setEditVals({...editVals, achieved: e.target.value})} style={{ ...inputStyle, padding: "6px 10px" }} /></div>
                  </div>
                  <button onClick={() => saveEdit(s.month)} style={{ background: "#c4704a", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>Save</button>
                  <button onClick={() => setEditing(null)} style={{ background: "#f0ebe4", color: "#7a6a5a", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>Cancel</button>
                </>
              ) : (
                <>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, color: "#7a6a5a" }}>Target: <strong style={{ color: "#3a2a1a" }}>RM {s.target.toLocaleString()}</strong></span>
                      <span style={{ fontSize: 13, color: "#7a6a5a" }}>Achieved: <strong style={{ color: hit ? "#2ecc71" : s.achieved > 0 ? "#c4704a" : "#c0b5ae" }}>RM {s.achieved.toLocaleString()}</strong></span>
                      {achieved_pct > 0 && <span style={{ fontSize: 13, fontWeight: 700, color: hit ? "#2ecc71" : "#c4704a" }}>{achieved_pct}% {hit && "🎯"}</span>}
                    </div>
                    <Bar value={s.achieved} max={s.target} color={hit ? "#2ecc71" : "#c4704a"} />
                  </div>
                  {isAdmin && <button onClick={() => startEdit(s.month)} style={{ background: "#faf7f3", color: "#7a6a5a", border: "1px solid #e8ddd5", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>✏️ Edit</button>}
                </>
              )}
            </div>
          );
        })}
      </div>}
    </div>
  );
}

// ── DOCS PAGE ─────────────────────────────────────────────────────────────────

function DocsPage({ docModal, setDocModal }) {
  if (docModal) {
    const doc = CORE_DOCS.find(d => d.id === docModal);
    return (
      <div>
        <button onClick={() => setDocModal(null)} style={{ background: "#faf7f3", color: "#7a6a5a", border: "1px solid #e8ddd5", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13, marginBottom: 20 }}>← Back to Documents</button>
        <div style={{ background: "#fff", borderRadius: 16, padding: "32px 36px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", maxWidth: 700 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span style={{ fontSize: 28 }}>{doc.icon}</span>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a", margin: 0 }}>{doc.title}</h2>
            <span style={{ background: "#fde8d8", color: "#c4704a", fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 99, marginLeft: "auto" }}>READ ONLY</span>
          </div>
          <div style={{ borderTop: "1px solid #f0ebe4", paddingTop: 20 }}>
            {doc.content.split("\n").map((line, i) => {
              if (line.startsWith("## ")) return <h3 key={i} style={{ color: "#5a4a3a", fontSize: 15, marginTop: 20, marginBottom: 8 }}>{line.replace("## ","")}</h3>;
              if (line.startsWith("# ")) return <h2 key={i} style={{ color: "#3a2a1a", fontSize: 20, marginTop: 0, marginBottom: 16 }}>{line.replace("# ","")}</h2>;
              if (line.startsWith("**") && line.endsWith("**")) return <p key={i} style={{ fontWeight: 700, color: "#3a2a1a", margin: "12px 0 4px" }}>{line.replace(/\*\*/g,"")}</p>;
              if (line.startsWith("- ")) return <p key={i} style={{ color: "#5a4a3a", fontSize: 14, margin: "4px 0", paddingLeft: 16 }}>• {line.replace("- ","")}</p>;
              if (line.startsWith("*") && line.endsWith("*")) return <p key={i} style={{ color: "#9a8a7a", fontSize: 12, fontStyle: "italic", marginTop: 16 }}>{line.replace(/\*/g,"")}</p>;
              if (line.startsWith("---")) return <hr key={i} style={{ border: "none", borderTop: "1px solid #f0ebe4", margin: "16px 0" }} />;
              if (line === "") return <div key={i} style={{ height: 8 }} />;
              return <p key={i} style={{ color: "#5a4a3a", fontSize: 14, lineHeight: 1.7, margin: "4px 0" }}>{line}</p>;
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a", marginBottom: 6 }}>📁 Core Documents</h2>
      <p style={{ color: "#9a8a7a", fontSize: 13, marginBottom: 24 }}>Read-only reference documents for all team members.</p>
      <div className="docs-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {CORE_DOCS.map(doc => (
          <div key={doc.id} onClick={() => setDocModal(doc.id)} style={{ background: "#fff", borderRadius: 16, padding: "28px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", cursor: "pointer", transition: "all 0.2s", border: "1.5px solid transparent" }}
            onMouseEnter={e => { e.currentTarget.style.transform="translateY(-3px)"; e.currentTarget.style.boxShadow="0 8px 24px rgba(196,112,74,0.12)"; e.currentTarget.style.borderColor="#fde8d8"; }}
            onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor="transparent"; }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>{doc.icon}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#3a2a1a", marginBottom: 8 }}>{doc.title}</div>
            <div style={{ fontSize: 12, color: "#c4704a", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>🔒 Read Only · Click to view →</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ADMIN PAGE ────────────────────────────────────────────────────────────────

function AdminPage({ users, setUsers, leaveRequests, setLeaveRequests, checklists }) {
  const staffList = users.filter(u => u.role !== "admin");
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  // User management
  const [userModal, setUserModal] = useState(null); // null | "add" | userId
  const [userForm, setUserForm] = useState({ name: "", email: "", password: "", role: "staff", title: "" });
  const [userMsg, setUserMsg] = useState("");

  function genAvatar(name) {
    return name.trim().split(/\s+/).map(w => w[0] || "").join("").substring(0, 2).toUpperCase() || "?";
  }

  function openAddUser() {
    setUserForm({ name: "", email: "", password: "", role: "staff", title: "" });
    setUserMsg("");
    setUserModal("add");
  }

  function openEditUser(u) {
    setUserForm({ name: u.name, email: u.email, password: u.password || "", role: u.role, title: u.title || "" });
    setUserMsg("");
    setUserModal(u.id);
  }

  async function handleSaveUser() {
    if (!userForm.name.trim() || !userForm.email.trim() || !userForm.password.trim() || !userForm.title.trim()) {
      setUserMsg("Please fill in all fields."); return;
    }
    const avatar = genAvatar(userForm.name);

    if (userModal === "add") {
      const { data, error } = await supabase.from("users").insert({
        name: userForm.name.trim(),
        email: userForm.email.trim().toLowerCase(),
        password: userForm.password,
        role: userForm.role,
        job_title: userForm.title.trim(),
        avatar,
        annual_left: 12,
      }).select().single();
      if (error) { setUserMsg("❌ Failed: " + (error.message || "unknown error")); return; }
      setUsers(prev => [...prev, mapUser(data)]);
      setUserMsg("✅ User added!");
      setTimeout(() => setUserModal(null), 800);
    } else {
      const { error } = await supabase.from("users").update({
        name: userForm.name.trim(),
        email: userForm.email.trim().toLowerCase(),
        password: userForm.password,
        role: userForm.role,
        job_title: userForm.title.trim(),
        avatar,
      }).eq("id", userModal);
      if (error) { setUserMsg("❌ Failed: " + (error.message || "unknown error")); return; }
      setUsers(prev => prev.map(u => u.id !== userModal ? u : {
        ...u, name: userForm.name.trim(), email: userForm.email.trim().toLowerCase(),
        password: userForm.password, role: userForm.role, title: userForm.title.trim(), avatar,
      }));
      setUserMsg("✅ Updated!");
      setTimeout(() => setUserModal(null), 800);
    }
  }

  async function handleDeleteUser(uid) {
    if (!window.confirm("Delete this user? This cannot be undone.")) return;
    const { error } = await supabase.from("users").delete().eq("id", uid);
    if (error) { alert("Failed to delete user."); return; }
    setUsers(prev => prev.filter(u => u.id !== uid));
  }

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a", marginBottom: 6 }}>⚙️ Admin Overview</h2>
      <p style={{ color: "#9a8a7a", fontSize: 13, marginBottom: 24 }}>Full team snapshot for supervisors and admins.</p>

      <div className="admin-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
        {[
          { label: "Total Staff", value: staffList.length, color: "#c4704a", icon: "👥" },
          { label: "Pending Leave", value: leaveRequests.filter(l=>l.status==="Pending").length, color: "#f39c12", icon: "⏳" },
          { label: "Approved Leave", value: leaveRequests.filter(l=>l.status==="Approved").length, color: "#2ecc71", icon: "✅" },
          { label: "Checklists Submitted", value: staffList.filter(u=>checklists[u.id]?.[monthKey]).length, color: "#a07ab8", icon: "📋" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "#fff", borderRadius: 14, padding: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", textAlign: "center" }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{stat.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: "#9a8a7a" }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontWeight: 700, color: "#3a2a1a", fontSize: 15 }}>Staff Management</div>
          <button onClick={openAddUser} style={{ background: "#c4704a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+ Add User</button>
        </div>
        <div className="table-scroll">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Staff Member", "Role", "Title", "Annual Left", "Checklist", "Actions"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#9a8a7a", fontWeight: 700, borderBottom: "2px solid #f0ebe4" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.filter(u => u.role !== "admin").map(u => {
                const cl = checklists[u.id]?.[monthKey];
                const score = cl ? pct(cl.checks) : null;
                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f8f5f2" }}>
                    <td style={{ padding: "12px 12px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:"50%", background:"#c4704a", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700 }}>{u.avatar}</div>
                        <span style={{ fontWeight:600, color:"#3a2a1a" }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: "12px", color:"#7a6a5a", textTransform: "capitalize" }}>{u.role}</td>
                    <td style={{ padding: "12px", color:"#7a6a5a" }}>{u.title}</td>
                    <td style={{ padding: "12px" }}><span style={{ fontWeight:700, color: u.annualLeft<4?"#e74c3c":"#2ecc71" }}>{u.annualLeft}</span> / 12</td>
                    <td style={{ padding: "12px" }}>
                      {score !== null
                        ? <span style={{ background: score>=80?"#eafaf1":score>=60?"#fff4e0":"#fdf0f0", color:score>=80?"#27ae60":score>=60?"#f39c12":"#e74c3c", fontWeight:700, fontSize:12, padding:"3px 10px", borderRadius:99 }}>{score}%</span>
                        : <span style={{ color:"#c0b5ae", fontSize:12 }}>—</span>}
                    </td>
                    <td style={{ padding: "12px" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEditUser(u)} style={{ background: "#f0ebe4", color: "#7a6a5a", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>✏️ Edit</button>
                        <button onClick={() => handleDeleteUser(u.id)} style={{ background: "#fdf0f0", color: "#e74c3c", border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontSize: 12 }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {userModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "32px 28px", width: 440, maxWidth: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: "#3a2a1a", marginBottom: 20 }}>
              {userModal === "add" ? "Add New User" : "Edit User"}
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              <div>
                <label style={labelStyle}>Full Name</label>
                <input value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} placeholder="First Last" style={inputStyle} />
              </div>
              {userForm.name.trim() && (
                <div style={{ fontSize: 12, color: "#9a8a7a", marginTop: -8 }}>
                  Avatar: <span style={{ display:"inline-flex", width:22, height:22, borderRadius:"50%", background:"#c4704a", color:"#fff", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, marginLeft:4 }}>{genAvatar(userForm.name)}</span>
                </div>
              )}
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} placeholder="name@saltycustoms.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} placeholder="Set a password" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Role</label>
                <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} style={inputStyle}>
                  <option value="staff">Staff</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Job Title</label>
                <input value={userForm.title} onChange={e => setUserForm({...userForm, title: e.target.value})} placeholder="e.g. Sales Executive" style={inputStyle} />
              </div>
              {userModal === "add" && (
                <div style={{ fontSize: 12, color: "#9a8a7a", background: "#faf7f3", borderRadius: 8, padding: "8px 12px" }}>
                  Annual leave will default to <strong>12 days</strong>.
                </div>
              )}
              {userMsg && <div style={{ color: userMsg.startsWith("✅") ? "#2ecc71" : "#e74c3c", fontSize: 13, fontWeight: 600 }}>{userMsg}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={handleSaveUser} style={{ flex: 1, background: "#c4704a", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                  {userModal === "add" ? "Add User" : "Save Changes"}
                </button>
                <button onClick={() => setUserModal(null)} style={{ background: "#f0ebe4", color: "#7a6a5a", border: "none", borderRadius: 10, padding: "12px 18px", fontSize: 14, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SHARED STYLES ─────────────────────────────────────────────────────────────

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1.5px solid #e8ddd5",
  borderRadius: 10,
  fontSize: 14,
  outline: "none",
  fontFamily: '-apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
  background: "#fff",
  color: "#3a2a1a",
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: "#7a6a5a",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  display: "block",
  marginBottom: 6,
};
