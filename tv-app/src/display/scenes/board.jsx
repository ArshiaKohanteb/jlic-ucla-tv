import React, { useEffect, useState } from "react";
import { Time, Logos, QR, Count } from "./parts.jsx";
import { addDays, isLive } from "./util.js";

const SITE = "uclaminyan.com";
const ARC = 190;
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

// The zmanim stand on the horizon, and the sun walks along it through the day.
function Horizon({ z, hidden, now, tz, today }) {
  const todays = z?.days?.[today] || {};
  const after = todays.tzet && now > todays.tzet;
  const list = zmanRow(z, hidden, after ? addDays(today, 1) : today);
  if (!list.length) return null;
  const nextId = after ? list[0].id : list.find((x) => x.at > now)?.id;
  const n = list.length;
  const col = (i) => ((i + 0.5) / n) * 100;
  let sun = null;
  if (!after && todays.sunrise && now >= todays.sunrise) {
    const i = list.findIndex((x) => x.at > now);
    if (i > 0) sun = col(i - 1) + ((now - list[i - 1].at) / (list[i].at - list[i - 1].at)) * (100 / n);
    else if (i === 0) sun = col(0);
  }
  // Its real arc: on the line at sunrise and sunset, highest at midday.
  const height = todays.sunset > todays.sunrise ? Math.max(0, Math.sin(Math.PI * Math.min(1, (now - todays.sunrise) / (todays.sunset - todays.sunrise)))) * ARC : 0;
  return (
    <section className="horizon">
      <div className="horizon-line">{sun != null && <i className="sun" style={{ left: `${sun}%`, transform: `translateY(${-height}px)` }} />}</div>
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

function Minyanim({ list, tz }) {
  if (!list.length) return <p className="none">Minyan times coming soon</p>;
  return (
    <ul className="minyanim">
      {list.map((o) => (
        <li key={o.id + o.date} className={o.off ? "is-off" : ""}>
          <div className="m-top">
            <h2 dir="auto">{o.name}</h2>
            {o.epoch != null ? <Time epoch={o.epoch} tz={tz} /> : <span className="t">Time to come</span>}
          </div>
          <div className="m-bottom">
            <span dir="auto">{[o.day, o.place].filter(Boolean).join("  ·  ")}</span>
            <Count o={o} />
          </div>
        </li>
      ))}
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
        {shabbatView ? <ShabbatList sched={sched} tz={tz} /> : <Minyanim list={minyanim} tz={tz} />}
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
