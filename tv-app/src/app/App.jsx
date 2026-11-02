import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useTv, useZmanim, useNow } from "../display/hooks.js";
import { skyGradient } from "../display/sky.js";
import { startZmanimEngine } from "../shared/bootstrap.js";
import { TIMEZONE, formatEpoch, formatHHMM, localInfo, addDays, zonedEpoch } from "../shared/schedule.js";
import { minyanCalendar, closeWords, needWords, canCheckIn, myRecord, TEN } from "../shared/minyan.js";
import { subscribeAllSignups, saveSignup, patchSignup, removeSignup } from "../shared/signups.js";
import { ClockInput } from "../admin/ui.jsx";
import * as P from "../shared/polls.js";
import { watchAccount, signInEmail, createEmail, sendCode, linkPhone, resetPassword, saveProfile, leave, shortName, cleanPhone, friendlyError } from "./account.js";

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
function Meta({ o, now }) {
  const close = closeWords(o, now);
  const need = needWords(o);
  const lines = [o.perk, o.needsReader && !o.off ? (o.reader ? `Torah reader: ${o.reader}` : "No Torah reader yet") : ""].filter(Boolean);
  if (!close && !need && !lines.length) return null;
  return (
    <span className="meta">
      {(need || close) && <span className="urgent">{[need, close].filter(Boolean).join(" · ")}</span>}
      {lines.map((l) => <span key={l} dir="auto">{l}</span>)}
    </span>
  );
}

function Choice({ o, mine, onToggle, now }) {
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
      <span className="who" dir="auto">{mine ? (o.people.length > 1 ? `You and ${o.people.length - 1 + o.extra} ${o.people.length - 1 + o.extra === 1 ? "other" : "others"}` : "You're the first") : names(o)}</span>
      <Meta o={o} now={now} />
      {o.on && o.message && <span className="message" dir="auto">{o.message}</span>}
    </button>
  );
}

// Suggested times: tick any that work, and everyone sees where the votes are.
function Poll({ o, mine, onVote, now }) {
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
      <p className="poll-meta"><Meta o={o} now={now} /></p>
      {o.on && o.message && <p className="message" dir="auto">{o.message}</p>}
    </section>
  );
}

// Someone already in for today can still say they're late or can't make it.
function TodayRow({ o, mine, onLate, onOut }) {
  return (
    <section className="today">
      <p>You're in for <b>{o.name}</b> today{o.epoch != null ? ` at ${clock(o.epoch).time} ${clock(o.epoch).ampm}` : ""}</p>
      {o.on && o.message && <p className="today-note" dir="auto">{o.message}</p>}
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

// Number first, then the code that was texted to it.
function PhoneCode({ send, onError, onDone }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const go = (e) => {
    e.preventDefault();
    setBusy(true);
    const job = sent ? sent.confirm(code.trim()).then(() => onDone?.()) : send(cleanPhone(phone)).then(setSent);
    job.catch(onError).finally(() => setBusy(false));
  };
  return (
    <form onSubmit={go}>
      {sent
        ? <label>Code from the text<input required autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label>
        : <label>Phone number<input required autoFocus type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>}
      <button className="primary" type="submit" disabled={busy || (!sent && !cleanPhone(phone))}>{sent ? "Sign in" : "Text me a code"}</button>
    </form>
  );
}

function SignIn({ onClose }) {
  const [mode, setMode] = useState("start");
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "" });
  const [msg, setMsg] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const run = (job) => Promise.resolve().then(job).catch((e) => setMsg(friendlyError(e)));
  const submit = (e) => {
    e.preventDefault();
    setMsg("");
    if (mode === "new" && !/[@.]ucla\.edu$/i.test(f.email.trim())) { setMsg("Use your UCLA email, or sign in with your phone number."); return; }
    if (mode === "new" && !cleanPhone(f.phone)) { setMsg("Enter your phone number."); return; }
    run(() => (mode === "new" ? createEmail(f.name, f.email, f.password, cleanPhone(f.phone)) : signInEmail(f.email, f.password)));
  };
  return (
    <Sheet onClose={onClose}>
      <h2>Welcome</h2>
      <p className="sheet-sub">You'll only do this once.</p>
      {mode === "start" ? (
        <>
          <button className="primary" onClick={() => setMode("phone")}>Use my phone number</button>
          <button className="primary light" onClick={() => setMode("new")}>Sign in with UCLA email</button>
        </>
      ) : mode === "phone" ? <PhoneCode send={sendCode} onError={(e) => setMsg(friendlyError(e))} /> : (
        <form onSubmit={submit}>
          {mode === "new" && <label>Your name<input required autoComplete="name" value={f.name} onChange={set("name")} /></label>}
          {mode === "new" && <label>Phone number<input required type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} /></label>}
          <label>UCLA email<input required type="email" autoComplete="email" placeholder="you@g.ucla.edu" value={f.email} onChange={set("email")} /></label>
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

// Every account needs a name and a number, however they came in.
function NeedInfo({ user, onSave }) {
  const [name, setName] = useState(user.name || "");
  const [v, setV] = useState(user.phone || "");
  const [msg, setMsg] = useState("");
  return (
    <div className="sheet-bg">
      <div className="sheet" role="dialog" aria-modal="true">
        <h2>One last thing</h2>
        <form onSubmit={(e) => { e.preventDefault(); const phone = cleanPhone(v); if (phone) onSave({ name: name.trim(), phone }); else setMsg("Check that number."); }}>
          {!user.name && <label>Your name<input required autoFocus autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>}
          {!user.phone && <label>Phone number<input required type="tel" autoComplete="tel" value={v} onChange={(e) => setV(e.target.value)} /></label>}
          <button className="primary" type="submit">Done</button>
        </form>
        {msg && <p className="sheet-msg" role="alert">{msg}</p>}
      </div>
    </div>
  );
}

const waLink = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
const hhmm = (t) => formatHHMM(t);

// An admin's controls for one poll, right on the site.
function Manage({ tv, o, onClose }) {
  const [add, setAdd] = useState("08:00");
  const [room, setRoom] = useState(o.place);
  const times = o.times.length ? o.times : o.planned ? [o.planned] : [];
  const votesFor = (t) => o.votes?.find((x) => x.t === t)?.count ?? o.count;
  const when = o.locked || (o.on ? times[0] : "");
  const told = `Minyan is on! ${o.name} ${o.day.toLowerCase()}${when ? ` at ${hhmm(when)}` : ""}${o.place ? ` in the ${o.place}` : ""}.`;
  return (
    <Sheet onClose={onClose}>
      <h2 dir="auto">{o.name}</h2>
      <p className="sheet-sub">{o.day}</p>
      <div className="mg-times">
        {times.map((t) => {
          const picked = o.on && t === when;
          return (
            <div key={t} className={`mg-time ${picked ? "on" : ""}`}>
              <button onClick={() => (picked ? P.reopenPoll(tv, o) : P.confirmPoll(tv, o, t))}>
                <b>{hhmm(t)}</b><span>{votesFor(t)} of {TEN}</span><em>{picked ? "Confirmed" : "Confirm"}</em>
              </button>
              {times.length > 1 && !picked && <button className="mg-x" aria-label={`Remove ${hhmm(t)}`} onClick={() => P.setTimes(tv, o, times.filter((x) => x !== t))}><X size={18} /></button>}
            </div>
          );
        })}
      </div>
      <div className="mg-add"><ClockInput value={add} onChange={setAdd} /><button className="mg-link" onClick={() => add && P.setTimes(tv, o, [...times, add])}>Add time</button></div>
      <label className="mg-room">Room<input value={room} list="site-rooms" placeholder="Beit Midrash" onChange={(e) => setRoom(e.target.value)} onBlur={() => room !== o.place && P.setRoom(tv, o, room)} /></label>
      {o.on && <a className="primary wa" href={waLink(told)} target="_blank" rel="noreferrer" onClick={() => P.setMessage(tv, o, told)}>Tell the group on WhatsApp</a>}
      {o.off ? <button className="plain" onClick={() => P.reopenPoll(tv, o)}>Reopen</button> : <button className="plain" onClick={() => { P.cancelPoll(tv, o); onClose(); }}>Not happening</button>}
    </Sheet>
  );
}

const COMMON = { Shacharit: ["08:00", "09:00"], Mincha: ["13:10"], Arvit: ["19:00"] };

function OpenPollSheet({ tv, today, onClose }) {
  const tomorrow = addDays(today, 1);
  const [name, setName] = useState("Mincha");
  const [date, setDate] = useState(today);
  const [times, setTimes] = useState(COMMON.Mincha);
  const [add, setAdd] = useState("13:30");
  return (
    <Sheet onClose={onClose}>
      <h2>Open a poll</h2>
      <div className="pills">{Object.keys(COMMON).map((n) => <button key={n} className={name === n ? "on" : ""} onClick={() => { setName(n); setTimes(COMMON[n]); }}>{n}</button>)}</div>
      <div className="pills"><button className={date === today ? "on" : ""} onClick={() => setDate(today)}>Today</button><button className={date === tomorrow ? "on" : ""} onClick={() => setDate(tomorrow)}>Tomorrow</button></div>
      <div className="pills">{times.map((t) => <button key={t} className="on" onClick={() => setTimes(times.filter((x) => x !== t))}>{hhmm(t)} <X size={14} /></button>)}</div>
      <div className="mg-add"><ClockInput value={add} onChange={setAdd} /><button className="mg-link" onClick={() => add && setTimes([...new Set([...times, add])].sort())}>Add time</button></div>
      <button className="primary" disabled={!times.length} onClick={() => { P.openPoll(tv, { name, date, times, place: "" }); onClose(); }}>Open poll</button>
    </Sheet>
  );
}

function Profile({ user, onSave, onClose }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [linking, setLinking] = useState(false);
  const [msg, setMsg] = useState("");
  const [counts, setCounts] = useState(user.counts !== false);
  const [reads, setReads] = useState(!!user.reads);
  const [leads, setLeads] = useState(!!user.leads);
  return (
    <Sheet onClose={onClose}>
      <h2>Your account</h2>
      <form onSubmit={(e) => { e.preventDefault(); onSave({ name: name.trim() || user.name, phone: cleanPhone(phone) || user.phone, counts, reads, leads }); }}>
        <label>Your name<input required value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Phone number<input required type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={counts} onChange={(e) => setCounts(e.target.checked)} />Count me toward the ten</label>
        <label className="check"><input type="checkbox" checked={reads} onChange={(e) => setReads(e.target.checked)} />I can read Torah</label>
        <label className="check"><input type="checkbox" checked={leads} onChange={(e) => setLeads(e.target.checked)} />I can lead davening</label>
        <button className="primary" type="submit">Save</button>
      </form>
      {user.admin && !user.phoneLogin && (linking
        ? <PhoneCode send={linkPhone} onError={(e) => setMsg(friendlyError(e))} onDone={() => { setLinking(false); setMsg("Done. You can sign in with your phone now."); }} />
        : <button className="plain" onClick={() => setLinking(true)}>Sign in with my phone number too</button>)}
      {msg && <p className="sheet-msg" role="alert">{msg}</p>}
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
  const [managing, setManaging] = useState(null);

  useEffect(() => watchAccount(setUser), []);
  useEffect(() => subscribeAllSignups(setSignups), []);
  const needsZmanim = !!tv?.minyanim?.some((m) => m.time?.type === "zman");
  useEffect(() => { if (needsZmanim) startZmanimEngine(); }, [needsZmanim]);
  useEffect(() => { document.body.style.background = phoneSky(now); }, [now]);

  const goal = target(now);
  const all = useMemo(() => (tv ? minyanCalendar(tv, z, now, TIMEZONE, signups, 3) : []), [tv, z, now, signups]);
  const mineOf = (o) => (user ? o.people.find((p) => p.uid === user.uid) : null);
  // Tomorrow's polls, plus anything an admin opened for another day (a Mincha today, say).
  const open = all.filter((o) => o.date === goal.date || !o.auto || (o.date === today && o.on));
  const openNow = open.filter((o) => !(o.date === today && o.date !== goal.date && mineOf(o)));
  const days = [...new Set(openNow.map((o) => o.date))].sort();
  const lead = days[0] || goal.date;
  const leadWord = openNow.find((o) => o.date === lead)?.day || goal.word;
  const todayRows = all.filter((o) => o.date === today && o.date !== goal.date && mineOf(o));

  const entry = (who, more = {}) => ({ name: shortName(who.name), counts: who.counts !== false, at: Date.now(), ...(who.reads ? { reads: true } : {}), ...(who.leads ? { leads: true } : {}), ...more });
  const record = useMemo(() => (user ? myRecord(signups, user.uid, today) : null), [signups, user, today]);
  const here = all.find((o) => o.date === today && canCheckIn(o, now));
  const hereMine = here ? mineOf(here)?.here : false;
  const doHere = (o, who = user) => {
    if (!who) { setPending({ ...o, checkIn: true }); setSheet("signin"); return; }
    const mine = o.people.find((p) => p.uid === who.uid);
    navigator.vibrate?.(12);
    (mine ? patchSignup(o.date, o.id, who.uid, { here: true }) : saveSignup(o.date, o.id, who.uid, entry(who, { here: true }))).catch(fail);
  };
  // The QR code on the TV opens the site with ?here, and that checks you in.
  const scanned = useRef(new URLSearchParams(location.search).has("here"));
  useEffect(() => {
    if (!scanned.current || user === undefined || !tv || !here) return;
    scanned.current = false;
    doHere(here);
  }, [user, !!tv, here?.id]);

  const fail = () => { setToast("That didn't save. Try again."); setTimeout(() => setToast(""), 3500); };
  const join = (o, who = user) => {
    if (!who) { setPending(o); setSheet("signin"); return; }
    navigator.vibrate?.(12);
    saveSignup(o.date, o.id, who.uid, entry(who)).catch(fail);
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
    saveSignup(o.date, o.id, who.uid, entry(who, { at: mine?.at || Date.now(), times })).catch(fail);
  };

  // Finish the tap that started the sign-in.
  useEffect(() => {
    if (user && sheet === "signin") setSheet(null);
    if (user && pending) {
      if (pending.checkIn) doHere(pending, user);
      else if (pending.voteFor) vote(pending, pending.voteFor, false, user); else join(pending, user);
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
        {here && (
          <button className={`here ${hereMine ? "is-in" : ""}`} onClick={() => doHere(here)}>
            <span>{hereMine ? "You're checked in" : `Here for ${here.name}?`}</span>
            <b>{hereMine ? "Thank you" : "I'm here"}</b>
          </button>
        )}
        <h1>{leadWord}</h1>
        <p className="date">{longDate(lead)}</p>
        {record?.count > 0 && <p className="record">You've come {record.count} {record.count === 1 ? "time" : "times"}{record.streak > 1 ? ` · ${record.streak} days in a row` : ""}</p>}
        {todayRows.map((o) => (
          <TodayRow key={o.id} o={o} mine={mineOf(o)} onOut={() => out(o)}
            onLate={() => patchSignup(o.date, o.id, user.uid, { late: !mineOf(o).late }).catch(fail)} />
        ))}
        {!tv ? null : days.length ? days.map((d, i) => (
          <section key={d} className="day">
            {i > 0 && <h2 className="day-head">{openNow.find((o) => o.date === d).day}</h2>}
            <div className="choices">
              {openNow.filter((o) => o.date === d).map((o) => {
                const mine = mineOf(o);
                return (
                  <div key={o.id} className="card-wrap">
                    {o.options
                      ? <Poll o={o} now={now} mine={mine} onVote={(t, picked) => vote(o, t, picked)} />
                      : <Choice o={o} now={now} mine={mine} onToggle={() => (mine ? out(o) : join(o))} />}
                    {user?.admin && <button className="manage" onClick={() => setManaging(`${o.id}|${o.date}`)}>Manage</button>}
                  </div>
                );
              })}
            </div>
          </section>
        )) : <p className="rest">No minyan to sign up for yet.</p>}
        {user?.admin && <button className="open-poll" onClick={() => setSheet("open")}>Open a poll</button>}
      </main>

      <datalist id="site-rooms"><option value="Beit Midrash" /><option value="Prayer Room" /><option value="Law School 2477" /></datalist>
      <div id="robot-check" />
      {sheet === "signin" && <SignIn onClose={() => { setSheet(null); setPending(null); }} />}
      {user && (!user.phone || !user.name) && <NeedInfo user={user} onSave={(info) => patch(Object.fromEntries(Object.entries(info).filter(([, v]) => v)))} />}
      {sheet === "open" && <OpenPollSheet tv={tv} today={today} onClose={() => setSheet(null)} />}
      {managing && open.find((o) => `${o.id}|${o.date}` === managing) && <Manage tv={tv} o={open.find((o) => `${o.id}|${o.date}` === managing)} onClose={() => setManaging(null)} />}
      {sheet === "profile" && user && <Profile user={user} onClose={() => setSheet(null)} onSave={patch} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
