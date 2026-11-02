import React, { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Share2, CalendarPlus, X, Users } from "lucide-react";
import { useTv, useZmanim, useNow } from "../display/hooks.js";
import { startZmanimEngine } from "../shared/bootstrap.js";
import { TIMEZONE, formatEpoch, localInfo } from "../shared/schedule.js";
import { minyanCalendar, TEN } from "../shared/minyan.js";
import { subscribeSignups, saveSignup, patchSignup, removeSignup } from "../shared/signups.js";
import { watchAccount, signInGoogle, signInEmail, createEmail, resetPassword, saveProfile, leave, shortName, friendlyError } from "./account.js";

const clock = (epoch) => {
  if (epoch == null) return "Time to come";
  const f = formatEpoch(epoch, TIMEZONE);
  return `${f.time} ${f.ampm}`;
};
const place = (o) => [o.place, o.note].filter(Boolean).join(" · ");

function headline(o) {
  if (o.off) return "Not happening";
  if (o.started) return "Davening now";
  if (o.on) return "We're on";
  return o.need === 1 ? "One more and we're on" : `${o.need} more to go`;
}

function Dots({ count }) {
  return <div className="dots" role="img" aria-label={`${count} of ${TEN}`}>{Array.from({ length: TEN }, (_, i) => <i key={i} className={i < count ? "in" : ""} />)}</div>;
}

const calendarLink = (o) => {
  const stamp = (t) => new Date(t).toISOString().replace(/[-:]|\.\d+/g, "");
  const p = new URLSearchParams({ action: "TEMPLATE", text: `${o.name} at Hillel`, dates: `${stamp(o.epoch)}/${stamp(o.epoch + 30 * 60_000)}`, location: o.place || "Hillel at UCLA" });
  return `https://calendar.google.com/calendar/render?${p}`;
};

function share(o) {
  const text = `${o.name} ${o.day.toLowerCase()} at ${clock(o.epoch)}. ${o.on ? "We're on!" : `${o.need} more needed.`}`;
  const url = location.origin + location.pathname;
  if (navigator.share) navigator.share({ text, url }).catch(() => {});
  else navigator.clipboard?.writeText(`${text} ${url}`);
}

function Next({ o, mine, onJoin, onLeave, onLate }) {
  return (
    <section className={`next ${o.on ? "on" : ""} ${o.off ? "off" : ""}`}>
      <p className="when">{o.day}</p>
      <h1 dir="auto">{o.name}</h1>
      <p className="time">{clock(o.epoch)}</p>
      {place(o) && <p className="where" dir="auto">{place(o)}</p>}
      <Dots count={o.on ? TEN : o.count} />
      <p className="status">{headline(o)}</p>
      {!o.off && (mine ? (
        <>
          <button className="big is-in" onClick={onLeave}><Check size={22} strokeWidth={3} />You're in</button>
          <div className="sub-actions">
            <button className={mine.late ? "lit" : ""} onClick={onLate}><Clock3 size={17} />{mine.late ? "Running late" : "I'll be late"}</button>
            <button onClick={onLeave}><X size={17} />Can't make it</button>
          </div>
        </>
      ) : <button className="big" onClick={onJoin}>I'm in</button>)}
      {o.people.length > 0 && (
        <ul className="people">
          {o.people.map((p) => <li key={p.uid} className={p.late ? "late" : ""}>{p.name}{p.late ? " · late" : ""}</li>)}
          {o.extra > 0 && <li className="more">+{o.extra}</li>}
        </ul>
      )}
      <div className="tools">
        <button onClick={() => share(o)}><Share2 size={17} />Share</button>
        {o.epoch != null && <a href={calendarLink(o)} target="_blank" rel="noreferrer"><CalendarPlus size={17} />Calendar</a>}
      </div>
    </section>
  );
}

function Row({ o, mine, onToggle }) {
  return (
    <li className="row">
      <div className="row-text">
        <b dir="auto">{o.name}</b>
        <span>{o.day} · {clock(o.epoch)}{o.place ? ` · ${o.place}` : ""}</span>
      </div>
      <span className="row-count">{o.off ? "Off" : o.on ? "On" : `${o.count}/${TEN}`}</span>
      <button className={`tick ${mine ? "is-in" : ""}`} disabled={o.off} aria-label={`${mine ? "Leave" : "Join"} ${o.name}, ${o.day}`} aria-pressed={!!mine} onClick={onToggle}>
        <Check size={20} strokeWidth={3} />
      </button>
    </li>
  );
}

function Sheet({ onClose, children }) {
  return (
    <div className="sheet-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true">
        <button className="sheet-x" aria-label="Close" onClick={onClose}><X size={22} /></button>
        {children}
      </div>
    </div>
  );
}

function SignIn({ onClose }) {
  const [mode, setMode] = useState("start");
  const [f, setF] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const run = (job) => job().catch((e) => setMsg(friendlyError(e)));
  const submit = (e) => {
    e.preventDefault();
    setMsg("");
    run(() => (mode === "new" ? createEmail(f.name, f.email, f.password) : signInEmail(f.email, f.password)));
  };
  return (
    <Sheet onClose={onClose}>
      <h2>Join the minyan</h2>
      <p className="sheet-sub">Sign in once and you're set on this phone.</p>
      {mode === "start" && (
        <>
          <button className="big" onClick={() => run(signInGoogle)}>Continue with Google</button>
          <button className="plain" onClick={() => setMode("email")}>Use email instead</button>
        </>
      )}
      {mode !== "start" && (
        <form onSubmit={submit}>
          {mode === "new" && <label>Your name<input required autoComplete="name" value={f.name} onChange={set("name")} /></label>}
          <label>Email<input required type="email" autoComplete="email" value={f.email} onChange={set("email")} /></label>
          <label>Password<input required type="password" minLength={6} autoComplete={mode === "new" ? "new-password" : "current-password"} value={f.password} onChange={set("password")} /></label>
          <button className="big" type="submit">{mode === "new" ? "Create account" : "Sign in"}</button>
          <div className="sheet-links">
            <button type="button" className="plain" onClick={() => { setMsg(""); setMode(mode === "new" ? "email" : "new"); }}>{mode === "new" ? "I have an account" : "New here? Create an account"}</button>
            {mode === "email" && <button type="button" className="plain" onClick={() => (f.email ? resetPassword(f.email).then(() => setMsg("Check your email for a reset link."), () => setMsg("Check that email address.")) : setMsg("Enter your email first."))}>Forgot password?</button>}
          </div>
        </form>
      )}
      {msg && <p className="sheet-msg" role="alert">{msg}</p>}
    </Sheet>
  );
}

function Profile({ user, onSave, onClose }) {
  const [name, setName] = useState(user.name);
  const [counts, setCounts] = useState(user.counts !== false);
  return (
    <Sheet onClose={onClose}>
      <h2>Your account</h2>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ name: name.trim() || user.name, counts }); }}>
        <label>Your name<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={counts} onChange={(e) => setCounts(e.target.checked)} />Count me toward the ten</label>
        <button className="big" type="submit">Save</button>
      </form>
      <button className="plain" onClick={leave}>Sign out</button>
    </Sheet>
  );
}

export default function App() {
  const tv = useTv();
  const z = useZmanim();
  const now = useNow(30_000);
  const today = localInfo(now, TIMEZONE).dateKey;
  const [user, setUser] = useState(undefined);
  const [signups, setSignups] = useState({});
  const [sheet, setSheet] = useState(null);
  const [pending, setPending] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => watchAccount(setUser), []);
  useEffect(() => subscribeSignups(today, setSignups, () => setToast("Couldn't load sign-ups.")), [today]);

  // The zmanim engine is heavy on a phone, so it only runs when a minyan's time depends on it.
  const needsZmanim = !!tv?.minyanim?.some((m) => m.time?.type === "zman");
  useEffect(() => { if (needsZmanim) startZmanimEngine(); }, [needsZmanim]);

  const list = useMemo(() => (tv ? minyanCalendar(tv, z, now, TIMEZONE, signups) : []), [tv, z, now, signups]);

  const fail = () => { setToast("That didn't save. Try again."); setTimeout(() => setToast(""), 3500); };
  const join = (o, who = user) => {
    if (!who) { setPending(o); setSheet("signin"); return; }
    saveSignup(o.date, o.id, who.uid, { name: shortName(who.name), counts: who.counts !== false, at: Date.now() }).catch(fail);
  };
  const out = (o) => removeSignup(o.date, o.id, user.uid).catch(fail);
  const mineOf = (o) => (user ? o.people.find((p) => p.uid === user.uid) : null);

  // Finish the tap that started the sign-in.
  useEffect(() => {
    if (user && sheet === "signin") setSheet(null);
    if (user && pending) { join(pending, user); setPending(null); }
  }, [user]);

  const lead = list[0];
  const initial = (user?.name || "?")[0].toUpperCase();

  return (
    <div className="app">
      <header className="top">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="JLIC" />
        <span>UCLA Minyan</span>
        {user === undefined ? null : user
          ? <button className="me" aria-label="Your account" onClick={() => setSheet("profile")}>{initial}</button>
          : <button className="login" onClick={() => setSheet("signin")}>Sign in</button>}
      </header>

      {!tv ? <p className="quiet">Loading…</p> : !lead ? (
        <section className="next empty"><Users size={34} /><h1>No minyan posted yet</h1></section>
      ) : (
        <>
          <Next o={lead} mine={mineOf(lead)} onJoin={() => join(lead)} onLeave={() => out(lead)}
            onLate={() => patchSignup(lead.date, lead.id, user.uid, { late: !mineOf(lead).late }).catch(fail)} />
          {list.length > 1 && (
            <section className="soon">
              <h2>Coming up</h2>
              <ul>
                {list.slice(1, 7).map((o) => {
                  const mine = mineOf(o);
                  return <Row key={o.id + o.date} o={o} mine={mine} onToggle={() => (mine ? out(o) : join(o))} />;
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <footer className="foot">
        <img src={`${import.meta.env.BASE_URL}hillel.png`} alt="Hillel at UCLA" />
      </footer>

      {sheet === "signin" && <SignIn onClose={() => { setSheet(null); setPending(null); }} />}
      {sheet === "profile" && user && (
        <Profile user={user} onClose={() => setSheet(null)} onSave={(patch) => {
          const next = { ...user, ...patch };
          saveProfile(user, patch).then(() => { setUser(next); setSheet(null); }, fail);
        }} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
