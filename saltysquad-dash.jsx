import { useState, useEffect } from "react";

// ── DATA ──────────────────────────────────────────────────────────────────────

const USERS = [
  { id: 1, name: "King Quah",     email: "king@saltycustoms.com",     password: "king123",    role: "admin",      avatar: "KQ", annualLeft: 12, title: "Founder" },
  { id: 2, name: "Wilson Goh",    email: "wilson@saltycustoms.com",   password: "wilson123",  role: "supervisor", avatar: "WG", annualLeft: 12, title: "Managing Director" },
  { id: 3, name: "Puteri Inez",   email: "puteri@saltycustoms.com",   password: "puteri123",  role: "supervisor", avatar: "PI", annualLeft: 12, title: "Vice President" },
  { id: 4, name: "Adam Malek",    email: "adamo@saltycustoms.com",    password: "adam123",    role: "staff",      avatar: "AM", annualLeft: 12, title: "Creative Director" },
  { id: 5, name: "Angeline Chua", email: "angeline@saltycustoms.com", password: "angeline123",role: "staff",      avatar: "AC", annualLeft: 12, title: "Head of Growth" },
  { id: 6, name: "Leon Lim",      email: "leon@saltycustoms.com",     password: "leon123",    role: "staff",      avatar: "LL", annualLeft: 12, title: "Business Development Executive" },
  { id: 7, name: "Eric Tai",      email: "jason@saltycustoms.com",    password: "eric123",    role: "staff",      avatar: "ET", annualLeft: 12, title: "Sales & Performance Executive" },
  { id: 8, name: "Justin Shye",   email: "shye@saltycustoms.com",     password: "justin123",  role: "staff",      avatar: "JS", annualLeft: 12, title: "Special Officer" },
];

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

const INITIAL_LEAVE_REQUESTS = [];

const INITIAL_SALES = [
  { month: "Jan", target: 500000, achieved: 0 },
  { month: "Feb", target: 500000, achieved: 0 },
  { month: "Mar", target: 500000, achieved: 0 },
  { month: "Apr", target: 500000, achieved: 0 },
  { month: "May", target: 500000, achieved: 0 },
  { month: "Jun", target: 500000, achieved: 0 },
  { month: "Jul", target: 500000, achieved: 0 },
  { month: "Aug", target: 500000, achieved: 0 },
  { month: "Sep", target: 500000, achieved: 0 },
  { month: "Oct", target: 500000, achieved: 0 },
  { month: "Nov", target: 500000, achieved: 0 },
  { month: "Dec", target: 500000, achieved: 0 },
];

const INITIAL_CHECKLISTS = {};

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

// ── MAIN APP ──────────────────────────────────────────────────────────────────

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [users, setUsers] = useState(USERS);
  const [leaveRequests, setLeaveRequests] = useState(INITIAL_LEAVE_REQUESTS);
  const [sales, setSales] = useState(INITIAL_SALES);
  const [checklists, setChecklists] = useState(INITIAL_CHECKLISTS);
  const [docModal, setDocModal] = useState(null);

  if (!currentUser) return <Login users={users} onLogin={u => { setCurrentUser(u); setPage("dashboard"); }} />;

  const isAdmin = currentUser.role === "admin" || currentUser.role === "supervisor";

  const nav = [
    { id: "dashboard", label: "Dashboard", icon: "🏠" },
    { id: "leave", label: "Leave", icon: "🌴" },
    { id: "checklist", label: "Integrity", icon: "✅" },
    { id: "sales", label: "Sales", icon: "📊" },
    { id: "docs", label: "Documents", icon: "📁" },
    ...(isAdmin ? [{ id: "admin", label: "Admin", icon: "⚙️" }] : []),
  ];

  return (
    <div style={{ fontFamily: "'Georgia', serif", background: "#faf7f3", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* TOP NAV */}
      <header style={{ background: "#fff", borderBottom: "2px solid #f0ebe4", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#c4704a", letterSpacing: "-0.5px" }}>SALTY</span>
          <span style={{ fontSize: 22, fontWeight: 400, color: "#5a4a3a", letterSpacing: "-0.5px" }}>SQUAD</span>
          <span style={{ background: "#fde8d8", color: "#c4704a", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, marginLeft: 4, letterSpacing: 1 }}>DASH</span>
        </div>
        <nav style={{ display: "flex", gap: 4 }}>
          {nav.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)} style={{ background: page === n.id ? "#fde8d8" : "transparent", color: page === n.id ? "#c4704a" : "#7a6a5a", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: page === n.id ? 700 : 400, transition: "all 0.15s" }}>
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#c4704a", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700 }}>{currentUser.avatar}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#3a2a1a" }}>{currentUser.name}</div>
            <div style={{ fontSize: 11, color: "#c4704a" }}>{currentUser.title}</div>
          </div>
          <button onClick={() => setCurrentUser(null)} style={{ background: "none", border: "1px solid #e0d5cc", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontSize: 12, color: "#7a6a5a" }}>Sign out</button>
        </div>
      </header>

      {/* PAGE CONTENT */}
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1200, width: "100%", margin: "0 auto" }}>
        {page === "dashboard" && <DashboardPage currentUser={currentUser} users={users} leaveRequests={leaveRequests} checklists={checklists} sales={sales} isAdmin={isAdmin} setPage={setPage} />}
        {page === "leave" && <LeavePage currentUser={currentUser} users={users} setUsers={setUsers} leaveRequests={leaveRequests} setLeaveRequests={setLeaveRequests} isAdmin={isAdmin} />}
        {page === "checklist" && <ChecklistPage currentUser={currentUser} users={users} checklists={checklists} setChecklists={setChecklists} isAdmin={isAdmin} />}
        {page === "sales" && <SalesPage sales={sales} setSales={setSales} isAdmin={isAdmin} />}
        {page === "docs" && <DocsPage docModal={docModal} setDocModal={setDocModal} />}
        {page === "admin" && isAdmin && <AdminPage users={users} leaveRequests={leaveRequests} setLeaveRequests={setLeaveRequests} checklists={checklists} />}
      </main>
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────

function Login({ users, onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleLogin() {
    const u = users.find(u => u.email === email && u.password === password);
    if (u) { setError(""); onLogin(u); }
    else setError("Invalid email or password. Try again.");
  }

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #faf7f3 0%, #fde8d8 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Georgia', serif" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "48px 44px", width: 380, boxShadow: "0 8px 40px rgba(196,112,74,0.12)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌊</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#c4704a" }}>SALTYSQUAD</div>
          <div style={{ fontSize: 13, color: "#9a8a7a", marginTop: 4 }}>Team Dashboard · Sign In</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#7a6a5a", textTransform: "uppercase", letterSpacing: 0.5 }}>Email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="you@saltysquad.com" style={{ width: "100%", marginTop: 6, padding: "10px 14px", border: "1.5px solid #e8ddd5", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>
        <div style={{ marginBottom: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "#7a6a5a", textTransform: "uppercase", letterSpacing: 0.5 }}>Password</label>
          <input value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} type="password" placeholder="••••••••" style={{ width: "100%", marginTop: 6, padding: "10px 14px", border: "1.5px solid #e8ddd5", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }} />
        </div>
        {error && <div style={{ color: "#e74c3c", fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <button onClick={handleLogin} style={{ width: "100%", background: "#c4704a", color: "#fff", border: "none", borderRadius: 10, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 16, transition: "background 0.15s" }}>Sign In →</button>
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

function DashboardPage({ currentUser, users, leaveRequests, checklists, sales, isAdmin, setPage }) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const myChecklist = checklists[currentUser.id]?.[monthKey];
  const myScore = myChecklist ? pct(myChecklist.checks) : null;
  const latestSales = sales.filter(s => s.achieved > 0).slice(-1)[0];
  const pendingLeave = leaveRequests.filter(l => l.status === "Pending" && (isAdmin || l.userId === currentUser.id));
  const staffList = users.filter(u => u.role === "staff");

  const Card = ({ title, children, accent, onClick }) => (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 16, padding: "22px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", borderLeft: `4px solid ${accent}`, cursor: onClick ? "pointer" : "default", transition: "transform 0.15s, box-shadow 0.15s" }}
      onMouseEnter={e => { if(onClick) { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.1)"; }}}
      onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.06)"; }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#9a8a7a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: "#3a2a1a", margin: 0 }}>Good {now.getHours()<12?"morning":now.getHours()<17?"afternoon":"evening"}, {currentUser.name.split(" ")[0]} 👋</h1>
        <div style={{ color: "#9a8a7a", fontSize: 14, marginTop: 4 }}>{now.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" })}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 28 }}>
        <Card title="Annual Leave Left" accent="#c4704a" onClick={() => setPage("leave")}>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#c4704a" }}>{currentUser.annualLeft}<span style={{ fontSize: 16, color: "#9a8a7a", fontWeight: 400 }}> days</span></div>
          <Bar value={currentUser.annualLeft} max={12} color="#c4704a" />
        </Card>
        <Card title={`Integrity Score — ${MONTHS[now.getMonth()]}`} accent="#7ab8a0" onClick={() => setPage("checklist")}>
          {myScore !== null
            ? <><div style={{ fontSize: 36, fontWeight: 800, color: "#7ab8a0" }}>{myScore}<span style={{ fontSize: 16 }}>%</span></div><Bar value={myScore} max={100} color="#7ab8a0" /></>
            : <div style={{ fontSize: 14, color: "#9a8a7a" }}>Not submitted yet<br /><span style={{ color: "#c4704a", fontWeight: 600, fontSize: 13 }}>→ Complete checklist</span></div>}
        </Card>
        {latestSales && (
          <Card title={`Team Sales — ${latestSales.month}`} accent="#a07ab8" onClick={() => setPage("sales")}>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#a07ab8" }}>
              {Math.round((latestSales.achieved / latestSales.target) * 100)}<span style={{ fontSize: 16 }}>%</span>
            </div>
            <Bar value={latestSales.achieved} max={latestSales.target} color="#a07ab8" />
            <div style={{ fontSize: 11, color: "#9a8a7a", marginTop: 4 }}>RM {latestSales.achieved.toLocaleString()} / RM {latestSales.target.toLocaleString()}</div>
          </Card>
        )}
      </div>

      {pendingLeave.length > 0 && (
        <div style={{ background: "#fffbf5", border: "1.5px solid #fde8d8", borderRadius: 14, padding: "18px 22px", marginBottom: 22 }}>
          <div style={{ fontWeight: 700, color: "#c4704a", marginBottom: 12 }}>⏳ Pending Leave Requests {isAdmin && `(${pendingLeave.length})`}</div>
          {pendingLeave.map(l => {
            const u = users.find(u => u.id === l.userId);
            return (
              <div key={l.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:"1px solid #f0ebe4" }}>
                <div>
                  {isAdmin && <span style={{ fontWeight: 600, color: "#5a4a3a" }}>{u?.name} · </span>}
                  <span style={{ color: "#7a6a5a" }}>{l.type} Leave · {l.days} day{l.days > 1 ? "s" : ""}</span>
                  <span style={{ color: "#9a8a7a", fontSize: 12 }}> · {l.from} to {l.to}</span>
                </div>
                <span style={{ background: "#fff4e0", color: "#f39c12", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 99 }}>Pending</span>
              </div>
            );
          })}
        </div>
      )}

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
                    ? <><div style={{ display:"flex", justifyContent:"space-between", marginBottom: 6 }}><span style={{ fontSize: 12, color: "#7a6a5a" }}>Score</span><span style={{ fontSize: 12, fontWeight: 700, color: score>=80?"#2ecc71":score>=60?"#f39c12":"#e74c3c" }}>{score}%</span></div><Bar value={score} max={100} color={score>=80?"#2ecc71":score>=60?"#f39c12":"#e74c3c"} /></>
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

function LeavePage({ currentUser, users, setUsers, leaveRequests, setLeaveRequests, isAdmin }) {
  const [tab, setTab] = useState("apply");
  const [form, setForm] = useState({ type: "Annual", from: "", to: "", reason: "" });
  const [msg, setMsg] = useState("");

  function calcDays(from, to) {
    if (!from || !to) return 0;
    const d1 = new Date(from), d2 = new Date(to);
    return Math.max(0, Math.round((d2 - d1) / 86400000) + 1);
  }

  function handleApply() {
    const days = calcDays(form.from, form.to);
    if (!form.from || !form.to || !form.reason) { setMsg("Please fill in all fields."); return; }
    if (days <= 0) { setMsg("End date must be on or after start date."); return; }
    const bal = currentUser.annualLeft;
    if (days > bal) { setMsg(`Insufficient annual leave balance (${bal} days left).`); return; }
    setLeaveRequests(prev => [...prev, { id: Date.now(), userId: currentUser.id, ...form, days, status: "Pending" }]);
    setMsg("✅ Leave application submitted successfully!");
    setForm({ type: "Annual", from: "", to: "", reason: "" });
  }

  function handleAction(id, action) {
    const req = leaveRequests.find(l => l.id === id);
    if (!req) return;
    setLeaveRequests(prev => prev.map(l => l.id === id ? { ...l, status: action } : l));
    if (action === "Approved") {
      setUsers(prev => prev.map(u => {
        if (u.id !== req.userId) return u;
        return { ...u, annualLeft: u.annualLeft - req.days };
      }));
    }
  }

  const myRequests = leaveRequests.filter(l => l.userId === currentUser.id);
  const allRequests = leaveRequests;
  const days = calcDays(form.from, form.to);

  const TabBtn = ({ id, label }) => (
    <button onClick={() => setTab(id)} style={{ background: tab === id ? "#c4704a" : "#fff", color: tab === id ? "#fff" : "#7a6a5a", border: "1.5px solid " + (tab === id ? "#c4704a" : "#e8ddd5"), borderRadius: 8, padding: "7px 18px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{label}</button>
  );

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a", marginBottom: 8 }}>🌴 Leave Management</h2>
      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fde8d8", borderRadius: 12, padding: "14px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#c4704a" }}>{currentUser.annualLeft}</div>
          <div style={{ fontSize: 12, color: "#7a6a5a" }}>Annual Days Left</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <TabBtn id="apply" label="Apply for Leave" />
        <TabBtn id="history" label="My History" />
        {isAdmin && <TabBtn id="all" label="All Requests" />}
      </div>

      {tab === "apply" && (
        <div style={{ background: "#fff", borderRadius: 16, padding: "28px", maxWidth: 500, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <label style={labelStyle}>Leave Type</label>
              <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} style={inputStyle}>
                <option>Annual</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={labelStyle}>From</label>
                <input type="date" value={form.from} onChange={e => setForm({...form, from: e.target.value})} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>To</label>
                <input type="date" value={form.to} onChange={e => setForm({...form, to: e.target.value})} style={inputStyle} />
              </div>
            </div>
            {days > 0 && <div style={{ background: "#fde8d8", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#c4704a", fontWeight: 600 }}>📅 {days} working day{days > 1 ? "s" : ""} selected</div>}
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
            allRequests.map(l => <LeaveCard key={l.id} l={l} users={users} showUser={true} isAdmin={isAdmin} onAction={handleAction} />)
          )}
        </div>
      )}
    </div>
  );
}

function LeaveCard({ l, users, showUser, isAdmin, onAction }) {
  const u = users.find(u => u.id === l.userId);
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", marginBottom: 10, boxShadow: "0 1px 6px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", borderLeft: `4px solid ${statusColor(l.status)}` }}>
      <div>
        {showUser && <div style={{ fontWeight: 700, color: "#3a2a1a", marginBottom: 2 }}>{u?.name}</div>}
        <div style={{ fontSize: 13, color: "#5a4a3a" }}><strong>{l.type}</strong> · {l.days} day{l.days > 1 ? "s" : ""} · {l.from} → {l.to}</div>
        <div style={{ fontSize: 12, color: "#9a8a7a", marginTop: 2 }}>{l.reason}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ background: l.status === "Approved" ? "#eafaf1" : l.status === "Rejected" ? "#fdf0f0" : "#fff4e0", color: statusColor(l.status), fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99 }}>{l.status}</span>
        {isAdmin && l.status === "Pending" && (
          <>
            <button onClick={() => onAction(l.id, "Approved")} style={{ background: "#2ecc71", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>✓ Approve</button>
            <button onClick={() => onAction(l.id, "Rejected")} style={{ background: "#e74c3c", color: "#fff", border: "none", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontSize: 12 }}>✕ Reject</button>
          </>
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
  const canEdit = isCurrentUserMonth;

  function toggle(id) {
    if (!canEdit) return;
    setChecklists(prev => ({
      ...prev,
      [viewUserId]: {
        ...prev[viewUserId],
        [selectedMonth]: { ...cl, checks: { ...cl.checks, [id]: !cl.checks[id] } }
      }
    }));
  }

  function setRemarks(r) {
    setChecklists(prev => ({
      ...prev,
      [viewUserId]: { ...prev[viewUserId], [selectedMonth]: { ...cl, remarks: r } }
    }));
  }

  // Build month options (last 6 months)
  const monthOptions = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    monthOptions.push({ key, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }

  const score = scoreOf(cl.checks);
  const staffList = users.filter(u => u.role === "staff");

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a", marginBottom: 6 }}>✅ Professional Integrity Checklist</h2>
      <p style={{ color: "#9a8a7a", fontSize: 13, marginBottom: 20 }}>Monthly self-assessment. Check each item you've fulfilled this month.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button onClick={() => setTab("fill")} style={{ background: tab==="fill"?"#c4704a":"#fff", color: tab==="fill"?"#fff":"#7a6a5a", border:"1.5px solid "+(tab==="fill"?"#c4704a":"#e8ddd5"), borderRadius:8, padding:"7px 18px", cursor:"pointer", fontSize:13, fontWeight:600 }}>My Checklist</button>
        {isAdmin && <button onClick={() => setTab("overview")} style={{ background: tab==="overview"?"#c4704a":"#fff", color: tab==="overview"?"#fff":"#7a6a5a", border:"1.5px solid "+(tab==="overview"?"#c4704a":"#e8ddd5"), borderRadius:8, padding:"7px 18px", cursor:"pointer", fontSize:13, fontWeight:600 }}>Bird's Eye View</button>}
      </div>

      {tab === "fill" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
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
            </div>

            {CHECKLIST_SECTIONS.map(section => (
              <div key={section.id} style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", marginBottom: 14, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <div style={{ fontWeight: 700, color: "#5a4a3a", fontSize: 14, marginBottom: 12, paddingBottom: 8, borderBottom: "1px solid #f0ebe4" }}>{section.label}</div>
                {section.items.map(item => (
                  <div key={item.id} onClick={() => toggle(item.id)} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 6px", borderRadius: 8, cursor: canEdit ? "pointer" : "default", transition: "background 0.1s" }}
                    onMouseEnter={e => { if(canEdit) e.currentTarget.style.background="#faf7f3"; }}
                    onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${cl.checks[item.id] ? "#c4704a" : "#d0c5bc"}`, background: cl.checks[item.id] ? "#c4704a" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, transition: "all 0.15s" }}>
                      {cl.checks[item.id] && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 13, color: cl.checks[item.id] ? "#3a2a1a" : "#7a6a5a", lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            ))}

            <div style={{ background: "#fff", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
              <div style={{ fontWeight: 700, color: "#5a4a3a", fontSize: 14, marginBottom: 10 }}>📝 Remarks</div>
              <textarea value={cl.remarks || ""} onChange={e => setRemarks(e.target.value)} disabled={!canEdit} rows={3} placeholder={canEdit ? "Add your self-assessment remarks here..." : "No remarks added."} style={{ ...inputStyle, resize: "vertical", width: "100%", boxSizing: "border-box" }} />
            </div>
          </div>

          {/* Score card */}
          <div style={{ position: "sticky", top: 80 }}>
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
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflowX: "auto" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#3a2a1a", marginBottom: 20 }}>Month-on-Month Integrity Scores</div>
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
      )}
    </div>
  );
}

// ── SALES PAGE ────────────────────────────────────────────────────────────────

function SalesPage({ sales, setSales, isAdmin }) {
  const [editing, setEditing] = useState(null);
  const [editVals, setEditVals] = useState({});

  function startEdit(idx) {
    setEditing(idx);
    setEditVals({ target: sales[idx].target, achieved: sales[idx].achieved });
  }

  function saveEdit(idx) {
    setSales(prev => prev.map((s, i) => i === idx ? { ...s, target: Number(editVals.target), achieved: Number(editVals.achieved) } : s));
    setEditing(null);
  }

  const maxVal = Math.max(...sales.map(s => Math.max(s.target, s.achieved)), 1);

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a", marginBottom: 6 }}>📊 Team Sales Targets</h2>
      <p style={{ color: "#9a8a7a", fontSize: 13, marginBottom: 24 }}>Monthly team sales performance. {isAdmin ? "Click a row to edit targets and achieved scores." : "View-only."}</p>

      {/* Chart */}
      <div style={{ background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#9a8a7a", marginBottom: 16 }}>Visual Overview</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 160 }}>
          {sales.map((s, i) => {
            const tH = Math.round((s.target / maxVal) * 140);
            const aH = s.achieved > 0 ? Math.round((s.achieved / maxVal) * 140) : 0;
            const hit = s.achieved >= s.target && s.achieved > 0;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 140 }}>
                  <div title={`Target: RM${s.target.toLocaleString()}`} style={{ width: 18, height: tH, background: "#e8ddd5", borderRadius: "4px 4px 0 0" }} />
                  <div title={`Achieved: RM${s.achieved.toLocaleString()}`} style={{ width: 18, height: aH, background: hit ? "#2ecc71" : aH > 0 ? "#c4704a" : "#f0ebe4", borderRadius: "4px 4px 0 0", transition: "height 0.4s" }} />
                </div>
                <div style={{ fontSize: 11, color: "#9a8a7a", fontWeight: 600 }}>{s.month}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "#9a8a7a" }}>
          <span>▪ <span style={{ background: "#e8ddd5", padding: "1px 6px", borderRadius: 4 }}>Target</span></span>
          <span>▪ <span style={{ background: "#c4704a", padding: "1px 6px", borderRadius: 4, color:"#fff" }}>Achieved</span></span>
          <span>▪ <span style={{ background: "#2ecc71", padding: "1px 6px", borderRadius: 4, color:"#fff" }}>Hit Target ✓</span></span>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 16, padding: "24px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        {sales.map((s, i) => {
          const achieved_pct = s.target > 0 && s.achieved > 0 ? Math.round((s.achieved / s.target) * 100) : 0;
          const hit = s.achieved >= s.target && s.achieved > 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 0", borderBottom: "1px solid #f8f5f2" }}>
              <div style={{ width: 40, fontSize: 14, fontWeight: 700, color: "#5a4a3a" }}>{s.month}</div>
              {editing === i && isAdmin ? (
                <>
                  <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div><label style={{ fontSize: 11, color: "#9a8a7a" }}>Target (RM)</label><input type="number" value={editVals.target} onChange={e => setEditVals({...editVals, target: e.target.value})} style={{ ...inputStyle, padding: "6px 10px" }} /></div>
                    <div><label style={{ fontSize: 11, color: "#9a8a7a" }}>Achieved (RM)</label><input type="number" value={editVals.achieved} onChange={e => setEditVals({...editVals, achieved: e.target.value})} style={{ ...inputStyle, padding: "6px 10px" }} /></div>
                  </div>
                  <button onClick={() => saveEdit(i)} style={{ background: "#c4704a", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 13 }}>Save</button>
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
                  {isAdmin && <button onClick={() => startEdit(i)} style={{ background: "#faf7f3", color: "#7a6a5a", border: "1px solid #e8ddd5", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>✏️ Edit</button>}
                </>
              )}
            </div>
          );
        })}
      </div>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
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

function AdminPage({ users, leaveRequests, checklists }) {
  const staffList = users.filter(u => u.role === "staff");
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: "#3a2a1a", marginBottom: 6 }}>⚙️ Admin Overview</h2>
      <p style={{ color: "#9a8a7a", fontSize: 13, marginBottom: 24 }}>Full team snapshot for supervisors and admins.</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 28 }}>
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
        <div style={{ fontWeight: 700, color: "#3a2a1a", fontSize: 15, marginBottom: 18 }}>Staff Leave Balances</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              {["Staff Member", "Title", "Annual Left", "Checklist Status"].map(h => (
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
                  <td style={{ padding: "12px", color:"#7a6a5a" }}>{u.title}</td>
                  <td style={{ padding: "12px" }}><span style={{ fontWeight:700, color: u.annualLeft<4?"#e74c3c":"#2ecc71" }}>{u.annualLeft}</span> / 12</td>
                  <td style={{ padding: "12px" }}>
                    {score !== null
                      ? <span style={{ background: score>=80?"#eafaf1":score>=60?"#fff4e0":"#fdf0f0", color:score>=80?"#27ae60":score>=60?"#f39c12":"#e74c3c", fontWeight:700, fontSize:12, padding:"3px 10px", borderRadius:99 }}>{score}%</span>
                      : <span style={{ color:"#c0b5ae", fontSize:12 }}>Not submitted</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  fontFamily: "Georgia, serif",
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
