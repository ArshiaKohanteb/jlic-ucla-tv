import React, { useEffect, useState } from "react";
import { Time, Logos, QR, Count } from "./parts.jsx";
import { addDays, isLive } from "./util.js";
import { sunColor, moonPhase } from "../sky.js";
import { whenWords } from "../../shared/minyan.js";

const SITE = "uclaminyan.com";
const ARC = 84;
const BOARD = [
  ["sunrise", "Netz"], ["shemaGRA", "Latest Shema"], ["tefila", "Latest Shacharit"], ["hatzot", "Midday"],
  ["minchaGedola", "Earliest Mincha"], ["sunset", "Sunset"], ["tzet", "Tzeit"],
];

function zmanRow(z, hidden, date) {
  const vals = z?.days?.[date] || {};
  const weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const holiday = z?.calendar?.[date]?.holiday;
  const fast = holiday?.kind === "fast" && !/Kippur|Av/.test(holiday.name || "");
  const list = BOARD.filter(([id]) => vals[id] && !hidden.includes(id)).map(([id, label]) => ({ id, label, at: vals[id] }));
  if (fast && vals.alot) list.unshift({ id: "alot", label: "Fast from", at: vals.alot });
  if (weekday === 5 && z?.candleLighting) list.push({ id: "candles", label: "Candle Lighting", at: z.candleLighting });
  if (weekday === 6 && z?.havdalah) list.push({ id: "havdalah", label: "Havdalah", at: z.havdalah });
  return list.sort((a, b) => a.at - b.at);
}

// The sky's arc, from sunrise on the left to sunset on the right, drawn up to `f` of the way.
function arcPath(f) {
  const pts = [];
  for (let i = 0; i <= 80; i++) {
    const x = (i / 80) * f;
    pts.push(`${(x * 1000).toFixed(1)} ${(ARC - Math.sin(Math.PI * x) * ARC).toFixed(1)}`);
  }
  return "M" + pts.join("L");
}

function Moon({ phase }) {
  const r = 34;
  const waxing = phase < 0.5;
  const k = Math.cos(2 * Math.PI * phase);
  const rx = Math.abs(k) * r;
  const crescent = k > 0;
  const lit = `M0 ${-r} A${r} ${r} 0 0 ${waxing ? 1 : 0} 0 ${r} A${rx} ${r} 0 0 ${waxing === crescent ? 0 : 1} 0 ${-r}Z`;
  return (
    <svg className="moon" viewBox="-36 -36 72 72" aria-hidden="true">
      <circle r={r} fill="rgba(246, 242, 233, .08)" />
      <path d={lit} fill="#F6F2E9" />
    </svg>
  );
}

// The zmanim stand on the horizon. By day the sun rises and sets behind it;
// by night the moon crosses in tonight's real phase.
function Horizon({ z, hidden, now, tz, today }) {
  const todays = z?.days?.[today] || {};
  const after = todays.tzet && now > todays.tzet;
  const list = zmanRow(z, hidden, after ? addDays(today, 1) : today);
  if (!list.length) return null;
  const nextId = after ? list[0].id : list.find((x) => x.at > now)?.id;
  const n = list.length;
  const { sunrise: sr, sunset: ss } = todays;
  const M = 60_000;
  // Sunrise to sunset is the whole arc, whatever the zmanim below are doing.
  const day = sr && ss ? (now - sr) / (ss - sr) : null;
  const up = day != null && now > sr - 6 * M && now < ss + 6 * M;
  const f = up ? Math.min(1, Math.max(0, day)) : null;
  const lift = !up ? 0 : now < sr ? ((now - sr) / (6 * M)) * 0.2 : now > ss ? ((ss - now) / (6 * M)) * 0.2 : Math.sin(Math.PI * f);
  let moon = null;
  if (!up && sr) {
    const nextRise = after ? z?.days?.[addDays(today, 1)]?.sunrise || sr + 864e5 : sr;
    const start = after ? todays.tzet : (todays.tzet || ss) - 864e5;
    const m = (now - start) / (nextRise - start);
    if (m > 0 && m < 1) moon = { x: m * 100, y: Math.sin(Math.PI * m) * ARC };
  }
  return (
    <section className="horizon">
      {up && <i className="sun-glow" style={{ left: `${f * 100}%`, bottom: `${200 + Math.max(0, lift) * ARC}px`, opacity: 0.35 + (1 - Math.max(0, lift)) * 0.65 }} />}
      <div className="track">
        <svg className="dial" viewBox={`0 0 1000 ${ARC}`} preserveAspectRatio="none" aria-hidden="true">
          <path className="dial-all" d={arcPath(1)} vectorEffect="non-scaling-stroke" />
          {up && f > 0 && <path className="dial-past" d={arcPath(f)} vectorEffect="non-scaling-stroke" />}
        </svg>
        {up && <i className="sun" style={{ left: `${f * 100}%`, bottom: `${lift * ARC}px`, background: sunColor(lift * 2.4) }} />}
        {moon && <div className="moon-at" style={{ left: `${moon.x}%`, bottom: `${moon.y}px` }}><Moon phase={moonPhase(now)} /></div>}
      </div>
      <div className="horizon-line" />
      <div className="zmanim" style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, ...(n > 7 ? { "--zt": "58px", "--zl": "26px" } : {}) }}>
        {list.map((x) => (
          <div key={x.id} className={`zman ${x.id === nextId ? "is-next" : !after && x.at < now ? "is-past" : ""}`}>
            <i className="tick" />
            <Time epoch={x.at} tz={tz} />
            <span>{x.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function levana(z, today) {
  const L = z?.levana;
  const tzet = z?.days?.[today]?.tzet;
  if (!L || !tzet || tzet < L.start || tzet >= L.end) return null;
  return L.end - tzet < 24 * 3600_000 ? "Last night for Birkat Levana" : "Birkat Levana can be said tonight";
}

// One short line under the date that changes every so often.
function Notes({ tv, z, today }) {
  const s = tv.settings;
  const items = [];
  (tv.announcements || []).filter((a) => s.showTicker !== false && a.ticker !== false && isLive(a, today) && (a.style || "info") === "info").forEach((a) => items.push({ text: a.body || a.title }));
  const lev = s.showLevana !== false && levana(z, today);
  if (lev) items.push({ text: lev });
  const daf = s.showLimudim === false ? null : z?.limudim?.find((l) => l.id === "daf")?.ref;
  if (daf) items.push({ text: `דף יומי  ${daf}`, he: true });
  if (s.showMakam && z?.makam) items.push({ text: `Makam of the week: ${z.makam}` });
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((n) => n + 1), 9000);
    return () => clearInterval(t);
  }, [items.length]);
  if (!items.length) return null;
  const it = items[i % items.length];
  return <p className="note" key={it.text} dir={it.he ? "rtl" : "auto"}>{it.text}</p>;
}

function Minyanim({ list, tz, now }) {
  if (!list.length) return <p className="none">Minyan times coming soon</p>;
  return (
    <ul className={`minyanim ${list.length < 2 ? "solo" : ""}`}>
      {list.map((o) => {
        const when = whenWords(o, now);
        return (
          <li key={o.id + o.date} className={`${o.off ? "is-off" : ""} ${when.soon ? "is-soon" : ""}`}>
            <div className="m-top">
              <h2 dir="auto">{o.name}</h2>
              {o.epoch != null ? <Time epoch={o.epoch} tz={tz} /> : <span className="t">Time to come</span>}
            </div>
            <div className="m-bottom">
              <span dir="auto"><b>{when.text}</b>{o.place ? `  ·  ${o.place}` : ""}</span>
              <Count o={o} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ShabbatList({ sched, tz }) {
  const period = sched.groups.find((g) => g.key === "period" || g.key.startsWith("assur") || g.key.startsWith("special")) || sched.groups[0];
  const items = (period?.items || []).slice().sort((a, b) => a.epoch - b.epoch);
  return (
    <div className="shabbat">
      <header><h2>{period?.title || "Shabbat"}</h2>{period?.subtitle && <span dir="rtl">{period.subtitle}</span>}</header>
      {items.length ? (
        <ul>{items.map((m) => <li key={m.id + m.epoch}><span dir="auto">{m.name}</span><Time epoch={m.epoch} tz={tz} /></li>)}</ul>
      ) : <p className="none">Shabbat times coming soon</p>}
    </div>
  );
}

export default function Board({ tv, z, sched, now, tz, minyanim, shabbatView }) {
  const s = tv.settings;
  const parasha = s.showParasha === false ? "" : z?.parasha ? `פרשת ${z.parasha}` : sched?.holidayToday?.he || "";
  return (
    <div className="board">
      <div className="dates">
        <p className="date-en">{s.showCivilDate === false ? "" : z?.hebrewDate?.civil || ""}</p>
        <p className="date-he" dir="rtl">{[s.showHebrewDate === false ? "" : z?.hebrewDate?.hebrew, parasha].filter(Boolean).join("  ·  ")}</p>
        <Notes tv={tv} z={z} today={sched.today} />
      </div>
      <aside className="side">
        <Logos />
        {shabbatView ? <ShabbatList sched={sched} tz={tz} /> : <Minyanim list={minyanim} tz={tz} now={now} />}
        {!shabbatView && (
          <div className="signup">
            <QR value={`https://${SITE}`} label={`Sign up at ${SITE}`} />
            <p>Coming?<br /><b>{SITE}</b></p>
          </div>
        )}
      </aside>
      {s.showZmanim !== false && <Horizon z={z} hidden={s.hiddenZmanim || []} now={now} tz={tz} today={sched.today} />}
    </div>
  );
}
