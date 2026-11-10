import React, { useEffect, useMemo, useState } from "react";
import {
  MoonStar, Moon, Eye, Sunrise, BookOpen, Hourglass, Sun, SunMedium, Clock3, Flame, Sunset, Star,
  CalendarDays, MapPin, SlidersHorizontal, ChevronDown, User, Info,
} from "lucide-react";
import { useZmanim, useNow } from "../display/hooks.js";
import { skyGradient } from "../display/sky.js";
import { startZmanimEngine } from "../shared/bootstrap.js";
import { TIMEZONE, localInfo, zonedEpoch } from "../shared/schedule.js";
import { watchAccount, cameFromEmailLink, rememberedEmail, finishEmailLink, saveProfile, friendlyError } from "./account.js";
import { Sheet, SignIn, ConfirmEmail, NeedInfo, Profile } from "./App.jsx";
import { loadLib, rowsFor, MINHAGIM, ZMANIM, PARTS, DEFAULT_PREFS, hebrewDate, civilDate, weekFrom } from "./zmanim.js";
import "./home.css";

const ICONS = { alot: MoonStar, misheyakir: Eye, sunrise: Sunrise, shema: BookOpen, tefila: Hourglass, hatzot: Sun, minchaGedola: SunMedium, minchaKetana: Clock3, plag: Hourglass, candles: Flame, sunset: Sunset, tzet: Moon, rt: Star, midnight: Moon };
const PREFS_KEY = "zmanim-prefs";
const PENDING_KEY = "zmanim-pending"; // settings waiting for the sign-in to finish (an emailed link can open a new tab)

// Prefs travel as { hidden: { id: true } } because the database drops empty lists.
const fromSaved = (p) => (p ? { ...DEFAULT_PREFS, ...p, hidden: Array.isArray(p.hidden) ? p.hidden : Object.keys(p.hidden || {}) } : null);
const toSaved = (p) => ({ ...p, hidden: Object.fromEntries(p.hidden.map((id) => [id, true])) });
const readLocal = () => { try { return fromSaved(JSON.parse(localStorage.getItem(PREFS_KEY) || "null")); } catch { return null; } };
const writeLocal = (p) => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch { /* private mode */ } };

function Clock({ at, h24 }) {
  const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hourCycle: h24 ? "h23" : "h12", timeZone: TIMEZONE }).formatToParts(new Date(at));
  const time = parts.filter((p) => p.type !== "dayPeriod" && p.type !== "literal" || p.value === ":").map((p) => p.value).join("");
  const ampm = parts.find((p) => p.type === "dayPeriod")?.value;
  return <span className="z-clock">{time}{ampm && <small>{ampm}</small>}</span>;
}

const until = (ms) => {
  const m = Math.max(1, Math.round(ms / 60_000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

function Row({ r, h24, next, now, open, onToggle }) {
  const Icon = ICONS[r.id] || Clock3;
  return (
    <li className={`z-row ${next ? "is-next" : ""} ${open ? "is-open" : ""}`}>
      <button className="z-main" aria-expanded={open} onClick={onToggle}>
        <span className="z-icon"><Icon size={22} strokeWidth={1.8} /></span>
        <span className="z-text">
          <b>{r.label}</b>
          <span>{next ? `Next · in ${until(r.at - now)}` : r.sub}</span>
        </span>
        <Clock at={r.at} h24={h24} />
      </button>
      {open && (
        <div className="z-more">
          <p>{r.note}</p>
          <p className="z-by">Showing: {r.by}</p>
          {r.others.length > 0 && (
            <>
              <h4>Other opinions</h4>
              <dl>{r.others.map((o) => <div key={o.id + o.label}><dt>{o.label}</dt><dd><Clock at={o.at} h24={h24} /></dd></div>)}</dl>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function Switch({ label, hint, checked, onChange }) {
  return (
    <label className="z-switch">
      <span><b>{label}</b>{hint && <small>{hint}</small>}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

function Customize({ prefs, setPrefs, user, onSave, onSignIn, onClose }) {
  const set = (patch) => setPrefs({ ...prefs, ...patch });
  const shown = (id) => !prefs.hidden.includes(id);
  const toggle = (id, on) => set({ hidden: on ? prefs.hidden.filter((x) => x !== id) : [...prefs.hidden, id] });
  return (
    <Sheet onClose={onClose}>
      <h2>Customize zmanim</h2>
      <h3 className="z-h3">Minhag</h3>
      <div className="z-seg" role="radiogroup">
        {MINHAGIM.map((m) => <button key={m.id} role="radio" aria-checked={prefs.minhag === m.id} className={prefs.minhag === m.id ? "on" : ""} onClick={() => set({ minhag: m.id })}>{m.label}</button>)}
      </div>
      <p className="z-hint">{MINHAGIM.find((m) => m.id === prefs.minhag)?.note}</p>
      <h3 className="z-h3">Display</h3>
      <div className="z-group">
        <Switch label="24-hour time" checked={prefs.h24} onChange={(h24) => set({ h24 })} />
        <Switch label="Show shaah zmanit" hint="Length of a halachic hour today" checked={prefs.shaah} onChange={(shaah) => set({ shaah })} />
      </div>
      {PARTS.map((p) => (
        <React.Fragment key={p.id}>
          <h3 className="z-h3">{p.label}</h3>
          <div className="z-group">
            {ZMANIM.filter((z) => z.part === p.id).map((z) => <Switch key={z.id} label={z.label} hint={z.sub} checked={shown(z.id)} onChange={(on) => toggle(z.id, on)} />)}
          </div>
        </React.Fragment>
      ))}
      <div className="z-sheet-foot">
        {user
          ? <button className="primary" onClick={onSave}>Done</button>
          : <>
              <p className="z-hint">Sign in to keep these settings on every device.</p>
              <button className="primary" onClick={onSignIn}>Sign in to save</button>
              <button className="plain" onClick={onClose}>Not now</button>
            </>}
      </div>
    </Sheet>
  );
}

export default function Home({ onVote }) {
  const z = useZmanim();
  const now = useNow(30_000);
  const today = localInfo(now, TIMEZONE).dateKey;
  const [K, setK] = useState(null);
  const [user, setUser] = useState(undefined);
  const [saved, setSaved] = useState(() => readLocal() || DEFAULT_PREFS);
  const [draft, setDraft] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [date, setDate] = useState(null);
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState({});
  const [needEmail, setNeedEmail] = useState(false);
  const [toast, setToast] = useState("");
  const prefs = draft || saved;
  const day = date && date >= today ? date : today;

  useEffect(() => { startZmanimEngine(); loadLib().then(setK, () => setToast("Couldn't load the zmanim. Pull down to refresh.")); }, []);
  useEffect(() => watchAccount(setUser), []);
  useEffect(() => {
    if (!cameFromEmailLink()) return;
    if (rememberedEmail()) finishEmailLink(rememberedEmail()).catch((e) => setToast(friendlyError(e)));
    else setNeedEmail(true);
  }, []);
  // Signed in: their saved settings win. Settings changed before signing in are kept.
  useEffect(() => {
    if (!user) return;
    setSheet((s) => (s === "signin" ? null : s));
    let pending = draft;
    try { pending ||= fromSaved(JSON.parse(localStorage.getItem(PENDING_KEY) || "null")); localStorage.removeItem(PENDING_KEY); } catch { /* storage blocked */ }
    if (pending) { save(pending, user); return; }
    const theirs = fromSaved(user.zmanim);
    if (theirs) { setSaved(theirs); writeLocal(theirs); }
  }, [user?.uid]);
  useEffect(() => {
    const d = z?.days?.[today];
    document.body.style.background = d?.sunrise ? skyGradient(d, now) : skyGradient({ sunrise: zonedEpoch(today, "06:30", TIMEZONE), hatzot: zonedEpoch(today, "12:00", TIMEZONE), sunset: zonedEpoch(today, "17:30", TIMEZONE), tzet: zonedEpoch(today, "17:45", TIMEZONE) }, now);
  }, [now, z]);

  const save = (p, who = user) => {
    setSaved(p); writeLocal(p); setDraft(null); setSheet(null);
    if (who) saveProfile(who, { zmanim: toSaved(p) }).catch(() => setToast("Your settings didn't save. Try again."));
  };

  const { rows, hour } = useMemo(() => (K ? rowsFor(K, day, z, prefs) : { rows: [], hour: 0 }), [K, day, z, prefs]);
  const visible = rows.filter((r) => !prefs.hidden.includes(r.id));
  const nextId = day === today ? visible.find((r) => r.at > now)?.id : null;
  const heb = hebrewDate(day);
  const m = z?.melakha;
  const shabbat = m && z.candleLighting && z.havdalah ? m : null;
  const levana = z?.levana && z.levana.end > now && z.levana.start - now < 10 * 864e5 ? z.levana : null;
  const shortDate = (ms) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: TIMEZONE }).format(new Date(ms));
  const minhag = MINHAGIM.find((x) => x.id === prefs.minhag);
  const parasha = z?.parasha?.replace(/^פרשת\s*/, "");

  return (
    <div className="home">
      <header className="h-top">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="JLIC" />
        <img className="hillel" src={`${import.meta.env.BASE_URL}hillel.png`} alt="Hillel at UCLA" />
        <a className="h-vote" href="#vote" onClick={(e) => { e.preventDefault(); onVote(); }}>Vote for minyan</a>
        <button className="me" aria-label={user ? "Your account" : "Sign in"} onClick={() => setSheet(user ? "profile" : "signin")}>
          {user ? (user.name || "?")[0].toUpperCase() : <User size={20} />}
        </button>
      </header>

      <section className="h-hero">
        {parasha && <span className="h-chip"><BookOpen size={16} />Parshat {parasha}</span>}
        <h1 dir="rtl" lang="he">{heb.he}</h1>
        <p className="h-sub">{civilDate(day)} · {heb.en}</p>
        {levana && <span className="h-chip"><MoonStar size={16} />Kiddush Levana · {shortDate(levana.start)} – {shortDate(levana.end)}</span>}
        <div className="h-actions">
          <button className="h-pill" aria-expanded={picking} onClick={() => setPicking(!picking)}><CalendarDays size={18} />{day === today ? `Today, ${civilDate(day, { month: "short", day: "numeric" })}` : civilDate(day, { weekday: "short", month: "short", day: "numeric" })}<ChevronDown size={16} /></button>
          <button className="h-pill" onClick={() => { setDraft({ ...saved }); setSheet("customize"); }}><SlidersHorizontal size={18} />Customize</button>
        </div>
        {picking && (
          <div className="h-days">
            {weekFrom(today).map((d, i) => (
              <button key={d} className={d === day ? "on" : ""} onClick={() => { setDate(d); setPicking(false); }}>
                <small>{i === 0 ? "Today" : civilDate(d, { weekday: "short" })}</small><b>{Number(d.slice(8))}</b>
              </button>
            ))}
          </div>
        )}
        <p className="h-place"><MapPin size={15} />Hillel at UCLA</p>
      </section>

      <p className="h-note"><Info size={18} />{prefs.minhag === "hillel" ? "Showing the Hillel TV's times." : `Showing ${minhag.label} times.`} Change it in Customize.</p>

      {shabbat && (
        <section className="h-shabbat">
          <header><Flame size={20} /><div><b>{shabbat.title}{parasha && !shabbat.isYomTov ? ` · ${parasha}` : ""}</b><span>{civilDate(shabbat.start, { weekday: "short", month: "short", day: "numeric" })}{shabbat.end !== shabbat.start ? ` – ${civilDate(shabbat.end, { weekday: "short", month: "short", day: "numeric" })}` : ""}</span></div></header>
          <div>
            <p><small>Candle lighting</small><Clock at={z.candleLighting} h24={prefs.h24} /></p>
            <p><small>{shabbat.endLabel || "Havdalah"}</small><Clock at={z.havdalah} h24={prefs.h24} /></p>
          </div>
          {z.rabbeinuTam && <span className="h-rt">Rabbeinu Tam <Clock at={z.rabbeinuTam} h24={prefs.h24} /></span>}
        </section>
      )}

      {prefs.shaah && hour > 0 && <p className="h-shaah">Shaah zmanit today: <b>{Math.floor(hour / 60_000)} min {Math.round((hour % 60_000) / 1000)} sec</b></p>}

      {!K ? <p className="h-loading">Working out today's zmanim…</p> : PARTS.map((p) => {
        const list = visible.filter((r) => r.part === p.id);
        if (!list.length) return null;
        return (
          <section key={p.id} className="h-part">
            <h2>{p.label} <span lang="he">{p.he}</span></h2>
            <ul className="z-list">
              {list.map((r) => <Row key={r.id} r={r} h24={prefs.h24} now={now} next={r.id === nextId} open={!!open[r.id]} onToggle={() => setOpen({ ...open, [r.id]: !open[r.id] })} />)}
            </ul>
          </section>
        );
      })}

      <footer className="h-foot">
        <a href="#vote" onClick={(e) => { e.preventDefault(); onVote(); }}>Coming to minyan? Vote for a time</a>
        <p>Hillel at UCLA · {minhag.label}{prefs.minhag === "hillel" ? " · royzmanim.com" : ""}</p>
        <p>Consult your rabbi for halachic guidance</p>
      </footer>

      <div id="robot-check" />
      {sheet === "customize" && (
        <Customize prefs={prefs} setPrefs={setDraft} user={user}
          onSave={() => save(prefs)} onSignIn={() => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ } setSheet("signin"); }} onClose={() => { setDraft(null); setSheet(null); }} />
      )}
      {sheet === "signin" && <SignIn onClose={() => { setSheet(null); setDraft(null); try { localStorage.removeItem(PENDING_KEY); } catch { /* storage blocked */ } }} />}
      {sheet === "profile" && user && <Profile user={user} onClose={() => setSheet(null)} onSave={(changes) => saveProfile(user, changes).then(() => { setUser({ ...user, ...changes }); setSheet(null); })} />}
      {user && (!user.phone || !user.name) && <NeedInfo user={user} onSave={(info) => saveProfile(user, info).then(() => setUser({ ...user, ...info }))} />}
      {needEmail && <ConfirmEmail onDone={() => setNeedEmail(false)} />}
      {toast && <div className="toast" role="status" onClick={() => setToast("")}>{toast}</div>}
    </div>
  );
}
