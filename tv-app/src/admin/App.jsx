import React, { useEffect, useState } from "react";
import { LayoutDashboard, Users, Clock, Megaphone, Images, MonitorSmartphone, Settings as SettingsIcon, LogOut } from "lucide-react";
import { subscribeTv, seedTv, isDemo, setEditor } from "../shared/store.js";
import { watchUser, signIn, signOutUser, resetPassword, claimOwner } from "./services.js";
import { Button, Field, EditedBy } from "./ui.jsx";
import { can } from "./access.js";
import Home from "./sections/Home.jsx";
import Schedule from "./sections/Schedule.jsx";
import Minyan from "./sections/Minyan.jsx";
import Announcements from "./sections/Announcements.jsx";
import Media from "./sections/Media.jsx";
import Screen from "./sections/Screen.jsx";
import Settings from "./sections/Settings.jsx";
import LivePreview from "./sections/LivePreview.jsx";

// Which saved data each page covers, for "last change by …" in its header.
const PAGE_DATA = { minyan: ["minyanim"], schedule: ["minyanim", "shabbat", "special"], announcements: ["announcements"], media: ["flyers", "photos"], screen: ["settings"], settings: ["settings"] };
const lastEdit = (tv, page) => Object.entries(tv.edits || {})
  .filter(([k]) => !PAGE_DATA[page] || PAGE_DATA[page].includes(k))
  .map(([, v]) => v).sort((a, b) => (b.at || 0) - (a.at || 0))[0];

const NAV = [
  { group: "Content", items: [
    { id: "home", label: "Overview", icon: LayoutDashboard, blurb: "What's on the screen right now" },
    { id: "minyan", area: "schedule", label: "Minyan", icon: Users, blurb: "Sign-ups, the log and stats" },
    { id: "schedule", label: "Times", icon: Clock, blurb: "Minyanim, Shabbat and holiday schedules" },
    { id: "announcements", label: "Slides", icon: Megaphone, blurb: "Announcements, Mazal Tov and sponsors" },
    { id: "media", label: "Media", icon: Images, blurb: "Flyers and community photos" },
  ] },
  { group: "Screen", items: [
    { id: "screen", label: "Appearance", short: "Look", icon: MonitorSmartphone, blurb: "Theme, layout, rotation and clock" },
  ] },
  { group: "Owner", owner: true, items: [
    { id: "settings", label: "Settings", icon: SettingsIcon, blurb: "Location, screens, people and backups", tag: "Owner" },
  ] },
];

function useZmanim() {
  const [z, setZ] = useState(window.__TV_ZMANIM__ || null);
  useEffect(() => {
    const on = (e) => setZ({ ...e.detail });
    window.addEventListener("tv-zmanim-ready", on);
    return () => window.removeEventListener("tv-zmanim-ready", on);
  }, []);
  return z;
}

function Login() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      if (mode === "signin") await signIn(email, password);
      else if (mode === "reset") { await resetPassword(email); setMsg("Check your email for a reset link."); }
      else await claimOwner(email, password, name);
    } catch (err) {
      const c = err.code || "";
      setMsg(c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found") ? "Email or password is incorrect."
        : c.includes("too-many-requests") ? "Too many tries. Wait a minute and try again."
        : c.includes("operation-not-allowed") || c.includes("configuration-not-found") ? "Email sign-in isn't turned on in Firebase yet (see the setup guide)."
        : c.includes("email-already-in-use") ? "That email already has an account. Sign in instead."
        : err.message);
    }
    setBusy(false);
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="logo-mark" />
          <h1>JLIC UCLA<br />TV Studio</h1>
          <p>{mode === "setup" ? "First-time setup: create the owner account" : mode === "reset" ? "Reset your password" : "Sign in to manage the display"}</p>
        </div>
        {mode === "setup" && <Field label="Your name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>}
        <Field label="Email"><input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {mode !== "reset" && (
          <Field label="Password"><input className="input" type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        )}
        <Button variant="primary" className="btn-block" disabled={busy}>
          {busy ? "One moment…" : mode === "signin" ? "Sign in" : mode === "reset" ? "Send reset link" : "Create owner account"}
        </Button>
        {msg && <p className="login-msg">{msg}</p>}
        <div className="login-links">
          {mode !== "signin" && <button type="button" onClick={() => setMode("signin")}>Back to sign in</button>}
          {mode === "signin" && <button type="button" onClick={() => setMode("reset")}>Forgot password?</button>}
          {mode === "signin" && <button type="button" onClick={() => setMode("setup")}>First-time setup</button>}
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [tv, setTv] = useState(null);
  const [page, setPage] = useState(() => location.hash.slice(1) || "home");
  const z = useZmanim();

  useEffect(() => watchUser(setUser), []);
  useEffect(() => setEditor(user?.name || user?.email || ""), [user?.name, user?.email]);
  useEffect(() => {
    if (!user?.role) return;
    let seeded = false;
    return subscribeTv((data, meta) => {
      setTv(data);
      // First run: give the TV something to show.
      if (meta.empty && !seeded) { seeded = true; seedTv().catch(() => {}); }
    });
  }, [user?.role]);
  useEffect(() => { history.replaceState(null, "", "#" + page); window.scrollTo(0, 0); }, [page]);
  useEffect(() => {
    const on = () => setPage(location.hash.slice(1) || "home");
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  if (user === undefined) return <div className="loading"><div className="logo-mark pulse" /></div>;
  if (!user) return <Login />;
  if (!user.role) {
    return (
      <div className="login">
        <div className="login-card">
          <div className="login-brand"><div className="logo-mark" /><h1>No access yet</h1>
            <p>{user.email} isn't on the list of TV managers. Ask the owner to add you in Settings → People.</p></div>
          <Button onClick={signOutUser} icon={LogOut}>Sign out</Button>
        </div>
      </div>
    );
  }
  if (!tv) return <div className="loading"><div className="logo-mark pulse" /></div>;

  const isOwner = user.role === "owner";
  // Each manager only sees the pages they are allowed to change.
  const groups = NAV.filter((g) => !g.owner || isOwner)
    .map((g) => ({ ...g, items: g.items.filter((n) => n.id === "home" || g.owner || can(user, n.area || n.id)) }))
    .filter((g) => g.items.length);
  const items = groups.flatMap((g) => g.items);
  const current = items.find((n) => n.id === page) || items[0];
  const allowed = new Set(items.map((n) => n.id));
  const props = { tv, z, user, isOwner, go: (p) => allowed.has(p) && setPage(p) };
  const name = user.name || user.email || "";

  return (
    <div className="shell has-rail">
      <aside className="sidebar">
        <div className="side-brand"><div className="logo-mark" /><div><span>TV Studio</span></div></div>
        {groups.map((g) => (
          <nav className="nav-group" key={g.group}>
            <span className="nav-label">{g.group}</span>
            {g.items.map((n) => (
              <button key={n.id} className={current.id === n.id ? "on" : ""} onClick={() => setPage(n.id)}>
                <n.icon size={19} /><span>{n.label}</span>{n.tag && <span className="nav-tag">{n.tag}</span>}
              </button>
            ))}
          </nav>
        ))}
        <div className="side-foot">
          <div className="avatar">{(name[0] || "?").toUpperCase()}</div>
          <div className="who"><b>{name}</b><span>{user.role}</span></div>
          {!user.demo && <button className="icon-btn" onClick={signOutUser} aria-label="Sign out" title="Sign out"><LogOut size={18} /></button>}
        </div>
      </aside>

      <main className="main">
        <div className="main-inner">
          <header className="topbar">
            <div>
              <h1>{current.label}</h1>
              <p>{current.blurb}</p>
              <EditedBy item={lastEdit(tv, current.id)} prefix="Last change" className="topbar-edited" />
            </div>
            <div className="topbar-actions">
              <span className={`live-pill ${isDemo() ? "demo" : ""}`}><span className="live-dot" />{isDemo() ? "Preview mode" : "Saves instantly"}</span>
            </div>
          </header>
          {current.id === "home" && <Home {...props} />}
          {current.id === "minyan" && <Minyan {...props} />}
          {current.id === "schedule" && <Schedule {...props} />}
          {current.id === "announcements" && <Announcements {...props} />}
          {current.id === "media" && <Media {...props} />}
          {current.id === "screen" && <Screen {...props} />}
          {current.id === "settings" && <Settings {...props} />}
        </div>
      </main>

      <aside className="rail"><LivePreview tv={tv} controls={can(user, "screen")} /></aside>

      <nav className="tabbar">
        {items.map((n) => (
          <button key={n.id} className={current.id === n.id ? "on" : ""} onClick={() => setPage(n.id)}>
            <n.icon size={22} /><span>{n.short || n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
