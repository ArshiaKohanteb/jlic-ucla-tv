import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Brand, Clock, Time, countdownText, Ornament } from "./common.jsx";
import { minutesUntil } from "../../shared/schedule.js";
import { addDays, isLive } from "./util.js";

const dayName = (epoch, tz) => new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(epoch);

// Type scales from largest to smallest. The timetable starts at the largest and
// steps down (then splits into two columns) until every row fits its box.
const LEVELS = ["d-xl", "d-l", "d-m", "d-l two-col", "d-m two-col", "d-s two-col", "d-xs two-col", "d-xxs two-col"];

function Timetable({ groups, now, next, tz }) {
  const ref = useRef(null);
  const sig = groups.map((g) => g.key + ":" + g.items.length).join("|");
  const [level, setLevel] = useState(0);
  useEffect(() => setLevel(0), [sig]);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = el.parentElement;
    const cs = getComputedStyle(box);
    const room = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    // Rows bleed 28px past each side for the highlight, so allow that much width.
    const tooTall = el.scrollHeight > room + 1 || el.scrollWidth > el.clientWidth + 60;
    if (tooTall && level < LEVELS.length - 1) setLevel(level + 1);
  });

  if (!groups.length) {
    return (
      <section className="timetable d-xl" ref={ref}>
        <h2 className="group-title"><span>Today</span></h2>
        <p className="empty">No minyanim posted</p>
      </section>
    );
  }
  return (
    <section className={`timetable ${LEVELS[level]}`} ref={ref}>
      {groups.map((g, gi) => (
        <div key={g.key} className="group" style={{ "--gi": gi }}>
          <header className="group-head">
            <h2 className="group-title"><span>{g.title}</span></h2>
            {g.subtitle && g.subtitle !== g.title && <span className="group-sub" dir="auto">{g.subtitle}</span>}
          </header>
          <ul className="rows">
            {g.items.map((m, i) => {
              const state = next && m.id === next.id && m.epoch === next.epoch ? "is-next" : m.epoch < now ? "is-past" : "";
              return (
                <li key={m.id + m.epoch} className={`${state} cascade`} style={{ animationDelay: `${0.25 + gi * 0.25 + i * 0.06}s` }}>
                  <span className="row-name" dir="auto">
                    {m.name}
                    {m.note && <em>{m.note}</em>}
                  </span>
                  <Time epoch={m.epoch} tz={tz} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

// The day's zmanim on the sun's arc, with a live sun moving along it. Drawn at
// the panel's real pixel width so nothing stretches. Labels sit in even columns
// below; only the next zman gets a fine gold line up to its point on the arc.
const SH = 92, BASE = 82, AMP = 70;

function useWidth(ref) {
  const [w, setW] = useState(1500);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => setW(Math.max(200, Math.round(el.clientWidth)));
    set();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return w;
}

function SunPath({ z, hidden, now, tz, today }) {
  const body = useRef(null);
  const SW = useWidth(body);
  const todays = z?.days?.[today] || {};
  const afterNightfall = todays.tzet && now > todays.tzet;
  const vals = z?.days?.[afterNightfall ? addDays(today, 1) : today] || {};
  const list = (z?.zmanimList || []).filter((x) => !hidden.includes(x.id) && vals[x.id]).slice(0, 10);
  const ready = list.length && vals.sunrise && vals.sunset;

  let arc = "", X = () => 0, Y = () => 0;
  if (ready) {
    const t0 = Math.min(...list.map((x) => vals[x.id]), vals.sunrise) - 20 * 60_000;
    const t1 = Math.max(...list.map((x) => vals[x.id]), vals.sunset) + 20 * 60_000;
    const sr = vals.sunrise, ss = vals.sunset;
    X = (t) => 12 + ((t - t0) / (t1 - t0)) * (SW - 24);
    // Above the horizon by day; a gentle dip below it before sunrise and after sunset.
    Y = (t) => {
      if (t >= sr && t <= ss) return BASE - AMP * Math.sin((Math.PI * (t - sr)) / (ss - sr));
      const d = (t < sr ? sr - t : t - ss) / (90 * 60_000);
      return BASE + 8 * Math.min(1, d);
    };
    const pts = [];
    for (let i = 0; i <= 120; i++) { const t = t0 + ((t1 - t0) * i) / 120; pts.push(`${X(t).toFixed(1)},${Y(t).toFixed(1)}`); }
    arc = "M" + pts.join(" L");
  }
  const nowIn = ready && !afterNightfall && X(now) >= 0 && X(now) <= SW;
  const nx = nowIn ? X(now) : afterNightfall ? 0 : SW;
  const nextIdx = afterNightfall ? -1 : list.findIndex((x) => vals[x.id] > now);
  const col = (i) => ((i + 0.5) * SW) / Math.max(1, list.length);
  const isDay = vals.sunrise && now >= vals.sunrise && now <= vals.sunset;

  return (
    <section className="zband glass sunpath">
      {afterNightfall && <span className="sp-tomorrow">Tomorrow</span>}
      <div className="sp-body" ref={body}>
        {ready ? (
          <svg className="sp-svg" width={SW} height={SH} viewBox={`0 0 ${SW} ${SH}`} aria-hidden="true">
            <defs>
              <linearGradient id="sp-gold" x1="0" x2="1" y1="0" y2="0">
                <stop offset="0" stopColor="var(--acc-2)" />
                <stop offset="1" stopColor="var(--acc-1)" />
              </linearGradient>
              <radialGradient id="sp-sun">
                <stop offset="0" stopColor="#FFFBEA" />
                <stop offset=".35" stopColor="var(--acc-1)" />
                <stop offset="1" stopColor="var(--acc-1)" stopOpacity="0" />
              </radialGradient>
              <clipPath id="sp-past"><rect x="0" y="0" width={Math.max(0, nx)} height={SH} /></clipPath>
            </defs>
            <path className="sp-arc" d={arc} />
            <path className="sp-arc-past" d={arc} clipPath="url(#sp-past)" />
            {nextIdx >= 0 && (
              <line className="sp-leader" x1={X(vals[list[nextIdx].id])} y1={Y(vals[list[nextIdx].id])} x2={col(nextIdx)} y2={SH} />
            )}
            {list.map((x, i) => (
              <circle key={x.id} className={`sp-point ${vals[x.id] < now && !afterNightfall ? "is-past" : ""} ${i === nextIdx ? "is-next" : ""}`} cx={X(vals[x.id])} cy={Y(vals[x.id])} r={i === nextIdx ? 6 : 4} />
            ))}
            {nowIn && (
              <g className={isDay ? "sp-sun" : "sp-moon"} transform={`translate(${nx} ${Y(now)})`}>
                <circle r="30" fill="url(#sp-sun)" className="sp-glow" />
                <circle r="8" className="sp-core" />
              </g>
            )}
          </svg>
        ) : <div style={{ height: SH }} />}
        <div className="sp-labels" style={{ "--n": Math.max(1, list.length) }}>
          {list.map((x, i) => (
            <div key={x.id} className={`zman ${!afterNightfall && vals[x.id] < now ? "is-past" : ""} ${i === nextIdx ? "is-next" : ""}`}>
              <span className="zman-label">{x.label}</span>
              <Time epoch={vals[x.id]} tz={tz} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// "Birkat HaLevana tonight" when tonight's nightfall falls inside the window,
// or a heads-up a couple of days before it opens.
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

export default function ScheduleScene({ tv, z, sched, now, tz }) {
  const s = tv.settings;
  const on = (k) => s[k] !== false;
  const pill = !on("showParasha") ? "" : z?.parasha ? `פרשת ${z.parasha}` : sched.holidayToday?.he || (sched.period?.isYomTov ? sched.period.titleHe : "");
  const greeting = on("showGreeting") ? sched.greeting : null;
  const hasBulletin = s.showTicker || s.showDonate || s.showLimudim !== false || s.showMakam || s.showCandleBar !== false;

  return (
    <div className={`scene scene-schedule ${hasBulletin ? "has-bulletin" : ""}`}>
      <aside className="now glass">
        <div className="now-top">
          <Brand tv={tv} />
          {on("showBsd") && <span className="bsd" dir="rtl">בס״ד</span>}
        </div>

        <div className="now-main">
          <Clock showSeconds={s.showSeconds} tz={tz} className="clock-hero" />
          <Ornament className="now-rule" />
          <div className="now-dates">
            <div className="now-dates-l">
              {on("showCivilDate") && <div className="now-date">{z?.hebrewDate?.civil || ""}</div>}
              {on("showHebrewDate") && z?.hebrewDate?.hebrew && <div className="now-hebdate" dir="rtl">{z.hebrewDate.hebrew}</div>}
            </div>
            {(pill || greeting) && (
              <div className="now-dates-r">
                {pill && <span className="parasha" dir="rtl">{pill}</span>}
                {greeting && <span className="greeting">{greeting.en}</span>}
              </div>
            )}
          </div>
        </div>

        {!on("showNextCard") ? null : sched.next ? (
          <div className="now-next">
            <div className="now-next-top">
              <span className="now-next-label">Next</span>
              <span className="now-next-when">{countdownText(sched.next.epoch, now)}</span>
            </div>
            <div className="now-next-row">
              <span className="now-next-name" dir="auto">{sched.next.name}</span>
              <Time epoch={sched.next.epoch} tz={tz} />
            </div>
            <div className="now-next-bar"><span style={{ transform: `scaleX(${Math.max(0.04, Math.min(1, 1 - minutesUntil(sched.next.epoch, now) / 120))})` }} /></div>
          </div>
        ) : null}
      </aside>

      <main className="board glass">
        <Timetable groups={sched.groups} now={now} next={sched.next} tz={tz} />
      </main>

      {s.showZmanim && <SunPath z={z} hidden={s.hiddenZmanim || []} now={now} tz={tz} today={sched.today} />}
      <Bulletin tv={tv} z={z} today={sched.today} sched={sched} tz={tz} />
    </div>
  );
}
