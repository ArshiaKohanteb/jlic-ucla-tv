import React, { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { useTv, useZmanim, useNow } from "../display/hooks.js";
import { skyGradient } from "../display/sky.js";
import { startZmanimEngine } from "../shared/bootstrap.js";
import { TIMEZONE, formatEpoch, localInfo, addDays, zonedEpoch } from "../shared/schedule.js";
import { minyanCalendar, TEN } from "../shared/minyan.js";
import { subscribeSignups, saveSignup, patchSignup, removeSignup } from "../shared/signups.js";
import { watchAccount, signInGoogle, signInEmail, createEmail, resetPassword, saveProfile, leave, shortName, friendlyError } from "./account.js";

const clock = (epoch) => {
  if (epoch == null) return "Time to come";
  const f = formatEpoch(epoch, TIMEZONE);
  return { time: f.time, ampm: f.ampm };
};
const Time = ({ epoch }) => {
  const c = clock(epoch);
  return typeof c === "string" ? <span className="time">{c}</span> : <span className="time">{c.time}<small>{c.ampm}</small></span>;
};

// Sign-ups are for the next day. The chat keeps going past midnight, so until
// 3 AM "tomorrow" still means the morning people are about to wake up for.
function target(now) {
  const { dateKey, hour } = localInfo(now, TIMEZONE);
  return hour < 3 ? { date: dateKey, word: "Today" } : { date: addDays(dateKey, 1), word: "Tomorrow" };
}
const longDate = (date) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));

// A rough sky for the phone, so the zmanim engine never has to run just for the colour.
function phoneSky(now) {
  const { dateKey } = localInfo(now, TIMEZONE);
  const at = (t) => zonedEpoch(dateKey, t, TIMEZONE);
  return skyGradient({ sunrise: at("06:30"), hatzot: at("12:00"), sunset: at("17:30"), tzet: at("17:45") }, now);
}

function names(o) {
  const first = o.people.map((p) => p.name.split(" ")[0]);
  if (!first.length) return "Be the first";
  if (first.length <= 3) return first.join(", ");
  return `${first.slice(0, 3).join(", ")} and ${first.length - 3 + o.extra} more`;
}

function Marks({ count }) {
  return <div className="marks" aria-hidden="true">{Array.from({ length: TEN }, (_, i) => <i key={i} className={i < count ? "in" : ""} />)}</div>;
}

// The whole site: tap the minyan you're coming to.
function Choice({ o, mine, onToggle }) {
  const status = o.off ? "Not happening" : o.on ? "We're on" : `${o.count} of ${TEN}`;
  return (
    <button className={`choice ${mine ? "is-in" : ""} ${o.on ? "is-on" : ""}`} disabled={o.off} aria-pressed={!!mine} onClick={onToggle}>
      <span className="choice-top">
        <span className="name" dir="auto">{o.name}</span>
        <span className="tick"><Check size={26} strokeWidth={3} /></span>
      </span>
      <Time epoch={o.epoch} />
      {o.place && <span className="place" dir="auto">{o.place}</span>}
      <span className="choice-foot">
        {!o.on && !o.off && <Marks count={o.count} />}
        <span className="status">{status}</span>
      </span>
      <span className="who" dir="auto">{mine ? (o.people.length > 1 ? `You and ${o.people.length - 1 + o.extra} others` : "You're the first") : names(o)}</span>
      {o.message && <span className="message" dir="auto">{o.message}</span>}
    </button>
  );
}

// Suggested times: tick any that work, and everyone sees where the votes are.
function Poll({ o, mine, onVote }) {
  const lead = o.options.reduce((best, x) => (x.count > best.count ? x : best), o.options[0]);
  return (
    <section className="poll">
      <div className="poll-head">
        <span className="name" dir="auto">{o.name}</span>
        <span className="poll-hint">{o.on ? `We're on at ${clock(o.epoch).time}` : "Tap every time that works"}</span>
      </div>
      {o.place && <p className="place" dir="auto">{o.place}</p>}
      <div className="opts">
        {o.options.map((x) => {
          const picked = !!mine && (mine.times ? !!mine.times[x.t] : x.t === o.planned);
          return (
            <button key={x.t} className={`opt ${picked ? "is-in" : ""} ${x.t === lead.t && x.count ? "is-lead" : ""}`} aria-pressed={picked} onClick={() => onVote(x.t, picked)}>
              <span className="opt-top"><Time epoch={x.epoch} /><span className="tick"><Check size={22} strokeWidth={3} /></span></span>
              <span className="choice-foot"><Marks count={x.count} /><span className="status">{x.count}</span></span>
            </button>
          );
        })}
      </div>
      {o.message && <p className="message" dir="auto">{o.message}</p>}
    </section>
  );
}

// Someone already in for today can still say they're late or can't make it.
function TodayRow({ o, mine, onLate, onOut }) {
  return (
    <section className="today">
      <p>You're in for <b>{o.name}</b> today{o.epoch != null ? ` at ${clock(o.epoch).time} ${clock(o.epoch).ampm}` : ""}</p>
      {o.message && <p className="today-note" dir="auto">{o.message}</p>}
      <div>
        <button className={mine.late ? "lit" : ""} onClick={onLate}>{mine.late ? "Running late" : "I'll be late"}</button>
        <button onClick={onOut}>Can't make it</button>
      </div>
    </section>
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
  const run = (job) => Promise.resolve().then(job).catch((e) => setMsg(friendlyError(e)));
  const submit = (e) => {
    e.preventDefault();
    setMsg("");
    run(() => (mode === "new" ? createEmail(f.name, f.email, f.password) : signInEmail(f.email, f.password)));
  };
  return (
    <Sheet onClose={onClose}>
      <h2>Welcome</h2>
      <p className="sheet-sub">You'll only do this once.</p>
      {mode === "start" ? (
        <>
          <button className="primary" onClick={() => run(signInGoogle)}>Continue with Google</button>
          <button className="plain" onClick={() => setMode("email")}>Use email instead</button>
        </>
      ) : (
        <form onSubmit={submit}>
          {mode === "new" && <label>Your name<input required autoComplete="name" value={f.name} onChange={set("name")} /></label>}
          <label>Email<input required type="email" autoComplete="email" value={f.email} onChange={set("email")} /></label>
          <label>Password<input required type="password" minLength={6} autoComplete={mode === "new" ? "new-password" : "current-password"} value={f.password} onChange={set("password")} /></label>
          <button className="primary" type="submit">{mode === "new" ? "Create account" : "Sign in"}</button>
          <button type="button" className="plain" onClick={() => { setMsg(""); setMode(mode === "new" ? "email" : "new"); }}>{mode === "new" ? "I have an account" : "New here? Create an account"}</button>
          {mode === "email" && <button type="button" className="plain" onClick={() => (f.email ? resetPassword(f.email).then(() => setMsg("Check your email for a reset link."), () => setMsg("Check that email address.")) : setMsg("Enter your email first."))}>Forgot password?</button>}
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
        <button className="primary" type="submit">Save</button>
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
  useEffect(() => subscribeSignups(today, setSignups, () => {}), [today]);
  const needsZmanim = !!tv?.minyanim?.some((m) => m.time?.type === "zman");
  useEffect(() => { if (needsZmanim) startZmanimEngine(); }, [needsZmanim]);
  useEffect(() => { document.body.style.background = phoneSky(now); }, [now]);

  const goal = target(now);
  const all = useMemo(() => (tv ? minyanCalendar(tv, z, now, TIMEZONE, signups, 3) : []), [tv, z, now, signups]);
  const choices = all.filter((o) => o.date === goal.date);
  const mineOf = (o) => (user ? o.people.find((p) => p.uid === user.uid) : null);
  const todayRows = all.filter((o) => o.date === today && o.date !== goal.date && mineOf(o));

  const fail = () => { setToast("That didn't save. Try again."); setTimeout(() => setToast(""), 3500); };
  const join = (o, who = user) => {
    if (!who) { setPending(o); setSheet("signin"); return; }
    navigator.vibrate?.(12);
    saveSignup(o.date, o.id, who.uid, { name: shortName(who.name), counts: who.counts !== false, at: Date.now() }).catch(fail);
  };
  const out = (o) => removeSignup(o.date, o.id, user.uid).catch(fail);
  // A vote is a sign-up that remembers which times work. No times left means they're out.
  const vote = (o, t, picked, who = user) => {
    if (!who) { setPending({ ...o, voteFor: t }); setSheet("signin"); return; }
    const mine = o.people.find((p) => p.uid === who.uid);
    const had = mine?.times || (mine && o.planned ? { [o.planned]: true } : {});
    const times = { ...had };
    if (picked) delete times[t]; else times[t] = true;
    if (!Object.keys(times).length) return out(o);
    navigator.vibrate?.(12);
    saveSignup(o.date, o.id, who.uid, { name: shortName(who.name), counts: who.counts !== false, at: mine?.at || Date.now(), times }).catch(fail);
  };

  // Finish the tap that started the sign-in.
  useEffect(() => {
    if (user && sheet === "signin") setSheet(null);
    if (user && pending) {
      if (pending.voteFor) vote(pending, pending.voteFor, false, user); else join(pending, user);
      setPending(null);
    }
  }, [user]);

  const patch = (changes) => saveProfile(user, changes).then(() => { setUser({ ...user, ...changes }); setSheet(null); }, fail);

  return (
    <div className="app">
      <header className="top">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="JLIC" />
        <img className="hillel" src={`${import.meta.env.BASE_URL}hillel.png`} alt="Hillel at UCLA" />
        {user && <button className="me" aria-label="Your account" onClick={() => setSheet("profile")}>{(user.name || "?")[0].toUpperCase()}</button>}
      </header>

      <main>
        <h1>{goal.word}</h1>
        <p className="date">{longDate(goal.date)}</p>
        {todayRows.map((o) => (
          <TodayRow key={o.id} o={o} mine={mineOf(o)} onOut={() => out(o)}
            onLate={() => patchSignup(o.date, o.id, user.uid, { late: !mineOf(o).late }).catch(fail)} />
        ))}
        {!tv ? null : choices.length ? (
          <div className="choices">
            {choices.map((o) => {
              const mine = mineOf(o);
              if (o.options) return <Poll key={o.id} o={o} mine={mine} onVote={(t, picked) => vote(o, t, picked)} />;
              return <Choice key={o.id} o={o} mine={mine} onToggle={() => (mine ? out(o) : join(o))} />;
            })}
          </div>
        ) : <p className="rest">No minyan to sign up for yet.</p>}
      </main>

      {sheet === "signin" && <SignIn onClose={() => { setSheet(null); setPending(null); }} />}
      {sheet === "profile" && user && <Profile user={user} onClose={() => setSheet(null)} onSave={patch} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
