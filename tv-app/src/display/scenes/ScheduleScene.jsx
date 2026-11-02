import React, { useEffect, useState } from "react";
import { Time } from "./common.jsx";
import { addDays, isLive } from "./util.js";
import { MinyanCard } from "./board.jsx";

const dayName = (epoch, tz) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(epoch);

// The whiteboard's list, in its own words. Times come from the zmanim engine.
const BOARD = [
  ["sunrise", "Netz"], ["shemaGRA", "Latest Shema"], ["tefila", "Latest Shacharit"], ["hatzot", "Midday"],
  ["minchaGedola", "Earliest Mincha"], ["sunset", "Sunset"], ["tzet", "Tzeit"],
];

function Zmanim({ z, hidden, now, tz, today }) {
  const todays = z?.days?.[today] || {};
  const date = todays.tzet && now > todays.tzet ? addDays(today, 1) : today;
  const vals = z?.days?.[date] || {};
  const holiday = z?.calendar?.[date]?.holiday;
  const fast = holiday?.kind === "fast" && !/Kippur|Av/.test(holiday.name || "") && vals.alot;
  const list = [...(fast ? [["alot", "Fast from"]] : []), ...BOARD].filter(([id]) => vals[id] && (id === "alot" || !hidden.includes(id)));
  const nextId = list.find(([id]) => vals[id] > now)?.[0];
  return (
    <section className="zboard" style={{ "--cols": list.length }}>
      {list.map(([id, label]) => (
        <div key={id} className={`z ${id === nextId ? "is-next" : vals[id] < now ? "is-past" : ""}`}>
          <span className="z-label">{label}</span>
          <Time epoch={vals[id]} tz={tz} />
        </div>
      ))}
    </section>
  );
}

// The Rabbi's Shabbat list: Friday on one side, the day on the other.
export function ShabbatBoard({ z, sched, now, tz }) {
  const period = sched.groups.find((g) => g.key === "period" || g.key.startsWith("assur") || g.key.startsWith("special")) || sched.groups[0];
  const items = (period?.items || []).slice().sort((a, b) => a.epoch - b.epoch);
  const day = (m) => dayName(m.epoch, tz);
  const days = [...new Set(items.map(day))];
  const lit = z?.candleLighting;
  const hav = z?.havdalah;
  return (
    <section className="shabbat">
      <header className="shabbat-head">
        <h2>{period?.title || "Shabbat"}</h2>
        {period?.subtitle && <span dir="rtl">{period.subtitle}</span>}
      </header>
      <div className="shabbat-cols">
        {days.map((d) => (
          <div className="shabbat-col" key={d}>
            <h3>{d}</h3>
            <ul>
              {items.filter((m) => day(m) === d).map((m) => (
                <li key={m.id + m.epoch}><span dir="auto">{m.name}</span><Time epoch={m.epoch} tz={tz} /></li>
              ))}
            </ul>
          </div>
        ))}
        {!days.length && <p className="shabbat-empty">Shabbat times coming soon</p>}
      </div>
      <div className="shabbat-lights">
        {lit && lit > now && <div><span>Candle Lighting</span><Time epoch={lit} tz={tz} /></div>}
        {hav && <div><span>Havdalah</span><Time epoch={hav} tz={tz} /></div>}
      </div>
    </section>
  );
}

function levanaMessage(z, today) {
  const L = z?.levana;
  const tzet = z?.days?.[today]?.tzet;
  if (!L || !tzet) return null;
  const day = (t) => new Intl.DateTimeFormat("en-US", { timeZone: z.timezone, weekday: "long" }).format(t);
  if (tzet >= L.start && tzet < L.end) {
    const last = L.end - tzet < 24 * 3600_000;
    return last ? "Birkat HaLevana · ברכת הלבנה · Tonight is the last night" : `Birkat HaLevana · ברכת הלבנה · Can be said tonight, until ${day(L.end)} night`;
  }
  if (L.start > tzet && L.start - tzet < 3 * 24 * 3600_000) return `Birkat HaLevana · ברכת הלבנה · Begins ${day(L.start)} night`;
  return null;
}

// One message at a time along the bottom, so it can be read from the back of the room.
// Messages take turns on the left; the Daf Yomi stays on the right, joined by candle lighting on the
// two days before Shabbat / Yom Tov and by havdalah once it has begun.
function Bulletin({ tv, z, today, sched, tz }) {
  const s = tv.settings;
  const d = s.donate || {};
  const items = [];
  if (s.showTicker) {
    (tv.announcements || [])
      .filter((a) => a.ticker !== false && isLive(a, today) && (a.style || "info") === "info")
      .forEach((a) => items.push(a.body || a.title));
  }
  if (s.showLevana !== false) {
    const msg = levanaMessage(z, today);
    if (msg) items.push(msg);
  }
  if (s.showMakam && z?.makam) items.push(`Makam of the week   ·   ${z.makam}`);
  if (s.showDonate) {
    const ways = [d.venmo && `Venmo ${d.venmo}`, d.zelle && `Zelle ${d.zelle}`].filter(Boolean).join("   ·   ");
    if (ways) items.push(`Support ${tv.settings.shulName}   ·   ${ways}`);
  }
  const [i, setI] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setI((n) => n + 1), Math.max(6, (s.tickerSpeed || 60) / 6) * 1000);
    return () => clearInterval(t);
  }, [items.length, s.tickerSpeed]);
  const P = sched?.period;
  const started = P && (sched.inPeriod || (today >= P.start && today <= P.end));
  const soon = P && !started && (today === addDays(P.start, -1) || today === addDays(P.start, -2));
  const candles = s.showCandleBar === false || !P ? null
    : started ? (z?.havdalah ? { label: P.isYomTov ? P.endLabel : "Havdalah", epoch: z.havdalah } : null)
    : soon && z?.candleLighting ? { label: "Candle Lighting", epoch: z.candleLighting } : null;
  const daf = s.showLimudim === false ? null : z?.limudim?.find((l) => l.id === "daf")?.ref;
  if (!items.length && !candles && !daf) return null;
  const text = items.length ? items[i % items.length] : "";
  return (
    <footer className="bulletin glass">
      <div className="bulletin-roll">
        <span className="bulletin-mark">✦</span>
        <span key={i} className="bulletin-text" dir="auto">{text}</span>
      </div>
      {candles && (
        <div className="bulletin-fixed bulletin-candles">
          <span className="bulletin-label">{candles.label}</span>
          <span className="bulletin-value">{dayName(candles.epoch, tz).slice(0, 3)} <Time epoch={candles.epoch} tz={tz} /></span>
        </div>
      )}
      {daf && (
        <div className="bulletin-fixed bulletin-daf">
          <span className="bulletin-label">Daf Yomi</span>
          <span className="bulletin-value" dir="auto">{daf}</span>
        </div>
      )}
    </footer>
  );
}

export default function ScheduleScene({ tv, z, sched, now, tz, minyanim, shabbatView }) {
  const s = tv.settings;
  return (
    <div className={`scene scene-board ${shabbatView ? "is-shabbat" : ""}`}>
      {shabbatView ? <ShabbatBoard z={z} sched={sched} now={now} tz={tz} /> : (
        <div className={`mcards ${minyanim.length < 2 ? "mcards-solo" : ""}`}>
          {minyanim.map((o) => <MinyanCard key={o.id + o.date} o={o} tz={tz} solo={minyanim.length < 2} />)}
          {!minyanim.length && (
            <section className="mcard is-unknown mcard-solo">
              <div className="mcard-head"><h2 className="mcard-name">Minyan times</h2></div>
              <div className="mcard-sub">Coming soon</div>
            </section>
          )}
        </div>
      )}
      {s.showZmanim !== false && <Zmanim z={z} hidden={s.hiddenZmanim || []} now={now} tz={tz} today={sched.today} />}
      <Bulletin tv={tv} z={z} today={sched.today} sched={sched} tz={tz} />
    </div>
  );
}
