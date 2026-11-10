import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTv, useZmanim, useNow, useStage, useImageSizes } from "./hooks.js";
import { buildContent, slideSeconds } from "./rotation.js";
import { buildSchedule, formatEpoch, minutesUntil, localInfo, setHour24, TIMEZONE } from "../shared/schedule.js";
import { useHebrewFont } from "../shared/fonts.js";
import Board from "./scenes/Board.jsx";
import { FlyerSlide, PhotoSlide, AnnouncementSlide, DonateSlide, LogoSlide, ShabbatSlide, Bar, pickPhotos } from "./scenes/Slides.jsx";
import { skyGradient, nightness } from "./sky.js";
import { upcomingMinyanim } from "../shared/minyan.js";
import { subscribeAllSignups } from "../shared/signups.js";
import { subscribeAttendance, buildLog, buildStats } from "../shared/attendance.js";
import { subscribeLunches, lunchBoard } from "../shared/lunches.js";
import { MinyanSlide, LeaderboardSlide, LunchesSlide, asOn } from "./scenes/Minyan.jsx";
import { isDemo } from "../shared/store.js";

const params = new URLSearchParams(location.search);
const HOLD = params.get("hold"); // schedule | flyer | announcement (dashboard preview)
// /flipped sets window.__TV_FLIP__ for a TV mounted upside down.
const FLIP = !!window.__TV_FLIP__ || params.has("flip");
// Phones and tablets (and low-memory devices) get the light version: the full
// glass/light effects can exhaust a phone browser's memory and crash the tab.
const HANDHELD = (navigator.maxTouchPoints > 0 && Math.min(screen.width, screen.height) < 900)
  || (navigator.deviceMemory && navigator.deviceMemory <= 2)
  || params.has("lite");
const SCHEDULE = { kind: "schedule", key: "schedule" };
// ?demo&showcase: every slide in the rotation, the next minyan both as its poll and as
// "We're on", and a page around it (in an iframe) can jump to any slide by message.
const SHOWCASE = isDemo() && params.has("showcase");

// The loop, in two rounds:
//   times → next minyan → one flyer or announcement (if any) → donate
//   times → next minyan → leaderboard → free lunches
// Anything missing is skipped. The showcase shows the poll in the first round and
// "We're on" in the second, so both can be seen.
const ROUNDS_SKIP = ["minyan", "donate", "leaderboard", "lunches", "logo"];
function loop(content, turn) {
  const of = (kind) => content.find((c) => c.kind === kind);
  const minyan = content.filter((c) => c.kind === "minyan");
  const others = content.filter((c) => !ROUNDS_SKIP.includes(c.kind));
  const other = others.length ? others[turn % others.length] : null;
  const seq = [SCHEDULE, minyan[0], other, of("donate"), SCHEDULE, minyan[1] || minyan[0], of("leaderboard"), of("lunches")].filter(Boolean);
  return seq.filter((c, i) => !(c.kind === "schedule" && seq[i - 1]?.kind === "schedule") && !(i === seq.length - 1 && c.kind === "schedule" && seq.length > 1));
}

export default function App() {
  const tv = useTv();
  const z = useZmanim();
  const now = useNow(60_000);
  const stage = useStage();
  const tz = z?.timezone || TIMEZONE;

  const today = localInfo(now, tz).dateKey;
  const urls = useMemo(() => (tv?.flyers || []).map((f) => f.url).filter(Boolean), [tv]);
  const sizes = useImageSizes(urls);
  const baseContent = useMemo(() => (tv ? buildContent(tv, today, sizes) : []), [tv, today, sizes, urls.map((u) => sizes.get(u)?.w).join()]);
  setHour24(tv?.settings?.clock24);
  useHebrewFont(tv?.settings?.hebrewFont);
  const sched = useMemo(() => (tv ? buildSchedule(tv, z, now, tz) : null), [tv, z, now, tz]);
  const [signups, setSignups] = useState({});
  useEffect(() => subscribeAllSignups(setSignups), []);
  const minyanim = useMemo(() => (tv ? upcomingMinyanim(tv, z, now, tz, 2, signups) : []), [tv, z, now, tz, signups]);
  // Friday afternoon through Shabbat the Rabbi's Shabbat list takes over the board.
  const weekday = localInfo(now, tz);
  const shabbatView = !!sched && (sched.inPeriod || weekday.weekday === 6 || (weekday.weekday === 5 && weekday.hour >= 12) || (!minyanim.length && sched.groups.length > 0));

  // Everyone's minyanim so far (never reset) and the lunches they've had.
  const [attendance, setAttendance] = useState({});
  const [lunches, setLunches] = useState({});
  useEffect(() => subscribeAttendance(setAttendance), []);
  useEffect(() => subscribeLunches(setLunches), []);
  const lunchRows = useMemo(() => (tv ? lunchBoard(buildStats(buildLog(tv, signups, attendance, today), today).board, lunches) : []), [tv, signups, attendance, lunches, today]);
  // The next minyan gets its own slide: its poll, or who's coming once it reaches ten.
  const featured = shabbatView ? null : minyanim.find((o) => !o.off) || null;

  // From Thursday the coming Shabbat gets its own slide between flyers.
  const content = useMemo(() => {
    const s = tv?.settings || {};
    const coming = !shabbatView && sched?.groups.some((g) => g.key === "period");
    const list = coming ? [{ kind: "shabbat", key: "shabbat" }, ...baseContent] : [...baseContent];
    if (SHOWCASE && featured) list.unshift({ kind: "minyan", key: "minyan-poll", force: "poll" }, { kind: "minyan", key: "minyan-on", force: "on" });
    else if (featured && s.showMinyanSlide !== false) list.unshift({ kind: "minyan", key: "minyan" });
    if (s.showLeaderboard !== false && lunchRows.length) list.push({ kind: "leaderboard", key: "leaderboard" });
    if (s.showLunches !== false && lunchRows.some((r) => r.free > 0)) list.push({ kind: "lunches", key: "lunches" });
    return list;
  }, [baseContent, shabbatView, sched, !!featured, tv?.settings, lunchRows.length, lunchRows.some((r) => r.free > 0)]);

  // ── Rotation ──
  const [slides, setSlides] = useState({ cur: SCHEDULE, n: 0, tick: 0 });
  const [prev, setPrev] = useState(null);
  const pointer = useRef(0);
  const sinceSchedule = useRef(0);
  const step = useRef(0); // where we are in loop()
  const turn = useRef(0); // which flyer or announcement is up next
  const live = useRef({});
  live.current = { tv, content, sched };

  useEffect(() => {
    if (!tv) return;
    const { cur } = slides;
    // Previews pinned to flyers/announcements skip the opening schedule screen.
    const ms = HOLD && HOLD !== "schedule" && cur.kind === "schedule" ? 400 : slideSeconds(cur, tv.settings) * 1000;
    const t = setTimeout(() => {
      const { tv, content, sched } = live.current;
      const s = tv.settings;
      const holdForMinyan = s.holdBeforeMinyan > 0 && sched?.next && minutesUntil(sched.next.epoch) <= s.holdBeforeMinyan;
      let pool = content;
      if (HOLD === "flyer" || HOLD === "announcement" || HOLD === "community" || HOLD === "donate" || HOLD === "logo" || HOLD === "shabbat" || HOLD === "minyan" || HOLD === "leaderboard" || HOLD === "lunches") pool = content.filter((c) => c.kind === HOLD);
      const shabbatPause = s.pauseOnShabbat && sched?.inPeriod;
      const contentAllowed = HOLD !== "schedule" && pool.length > 0 && (HOLD || (!s.contentPaused && !holdForMinyan && !shabbatPause));

      let next = SCHEDULE;
      if (!HOLD) {
        if (contentAllowed) {
          const seq = loop(content, turn.current);
          step.current = (step.current + 1) % seq.length;
          if (step.current === 0) turn.current += 1;
          next = seq[step.current];
        } else step.current = 0;
      } else if (contentAllowed) {
        const between = Math.max(1, s.itemsBetween || 1);
        const wantContent = HOLD || cur.kind === "schedule" || sinceSchedule.current < between;
        if (wantContent) {
          if (s.slideOrder === "shuffle" && pool.length > 2) {
            let pickI;
            do { pickI = Math.floor(Math.random() * pool.length); } while (pool[pickI].key === cur.key);
            next = pool[pickI];
          } else {
            next = pool[pointer.current % pool.length];
            pointer.current = (pointer.current + 1) % pool.length;
          }
          sinceSchedule.current = cur.kind === "schedule" ? 1 : sinceSchedule.current + 1;
        }
      }
      if (next.kind === "schedule") sinceSchedule.current = 0;
      // A new key each time, so every collage is a fresh random pick.
      if (next.kind === "community") next = { ...next, key: "community-" + Date.now(), pick: pickPhotos(tv) };
      const show = () => {
        if (cancelled) return;
        if (next.key !== cur.key) setPrev({ slide: cur, n: slides.n });
        setSlides((p) => ({ cur: next, n: next.key !== p.cur.key ? p.n + 1 : p.n, tick: p.tick + 1 }));
      };
      // Decode the next slide's pictures first so the fade-in never stutters.
      const urls = next.kind === "community" ? (next.pick.photos || []).map((p) => p.url) : (next.items || []).map((f) => f.url);
      if (urls.length) predecode(urls).then(show);
      else show();
    }, ms);
    let cancelled = false;
    return () => { cancelled = true; clearTimeout(t); };
  }, [slides, !!tv]);

  // Showcase: tell the page around us what's on, and jump when it asks.
  useEffect(() => {
    if (!SHOWCASE || window.parent === window) return;
    const seen = new Set();
    const list = loop(content, turn.current).filter((c) => !seen.has(c.key) && seen.add(c.key)).map((c) => ({ key: c.key, kind: c.kind }));
    window.parent.postMessage({ type: "tv-slide", key: slides.cur.key, seconds: tv ? slideSeconds(slides.cur, tv.settings) : 0, list }, "*");
  }, [slides, content]);
  useEffect(() => {
    if (!SHOWCASE) return;
    const onMessage = (e) => {
      if (e.data?.type !== "tv-show") return;
      const { content } = live.current;
      const i = content.findIndex((c) => c.key === e.data.key);
      const next = e.data.key === "schedule" ? SCHEDULE : content[i];
      if (!next) return;
      pointer.current = i + 1;
      sinceSchedule.current = next.kind === "schedule" ? 0 : 1;
      const at = loop(content, turn.current).findIndex((c) => c.key === next.key);
      step.current = at >= 0 ? at : 0;
      setSlides((p) => {
        if (p.cur.key !== next.key) setPrev({ slide: p.cur, n: p.n });
        return { cur: next, n: p.cur.key !== next.key ? p.n + 1 : p.n, tick: p.tick + 1 };
      });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!prev) return;
    const t = setTimeout(() => setPrev(null), 1200);
    return () => clearTimeout(t);
  }, [prev]);

  // Warm the cache for the flyer after this one.
  useEffect(() => {
    const upcoming = content[pointer.current % (content.length || 1)];
    if (upcoming?.items) predecode(upcoming.items.map((f) => f.url));
  }, [slides.n, content]);

  // A daily refresh (3:30 AM unless the owner changes it) keeps a 24/7 stick healthy.
  useEffect(() => {
    const p = localInfo(now, tz);
    const [h, m] = String(tv?.settings?.dailyReload || "03:30").split(":").map(Number);
    if (p.hour === h && p.minute === m && performance.now() > 10 * 60_000) location.reload();
  }, [now]);

  const sky = skyGradient(z?.days?.[today], now);
  if (!tv) return <div className="viewport"><div className="sky" style={{ background: sky }} /></div>;

  const stars = nightness(z?.days?.[today], now);
  // A TV showing one image for months can burn it in, so everything drifts a few pixels.
  const [nx, ny] = DRIFT[Math.floor(now / (5 * 60_000)) % DRIFT.length];
  const flip = FLIP && !params.has("preview");
  const dim = nightDim(tv.settings, now, tz);
  const onBoard = slides.cur.kind === "schedule";

  const render = (slide) => {
    const props = { slide, tv, z, sched, now, tz };
    if (slide.kind === "flyer") return <FlyerSlide {...props} />;
    if (slide.kind === "announcement") return <AnnouncementSlide {...props} />;
    if (slide.kind === "community") return <PhotoSlide {...props} />;
    if (slide.kind === "donate") return <DonateSlide {...props} shabbat={sched?.inPeriod} />;
    if (slide.kind === "logo") return <LogoSlide />;
    if (slide.kind === "shabbat") return <ShabbatSlide {...props} />;
    // These read the live data, so a vote shows up while the slide is on screen.
    if (slide.kind === "minyan") return <MinyanSlide {...props} slide={{ ...slide, minyan: slide.force === "on" ? asOn(featured) : slide.force === "poll" ? { ...featured, on: false } : featured }} />;
    if (slide.kind === "leaderboard") return <LeaderboardSlide slide={{ ...slide, rows: lunchRows }} />;
    if (slide.kind === "lunches") return <LunchesSlide slide={{ ...slide, rows: lunchRows }} />;
    return <Board {...props} minyanim={minyanim} shabbatView={shabbatView} signups={signups} />;
  };

  return (
    <div className={`viewport fx-${tv.settings.effects === "lite" || HANDHELD ? "lite" : "full"} ${flip ? "is-flipped" : ""}`}>
      <div
        className={`stage ${onBoard ? "on-board" : "on-slide"}`}
        style={flip
          // Upside down: size with zoom so text is laid out at its real size; a scale transform
          // under the turn gets drawn as a resized picture by some browsers (blurry).
          ? { "--nx": `${nx}px`, "--ny": `${ny}px`, width: stage.w, height: stage.h, zoom: stage.scale, left: stage.x / stage.scale, top: stage.y / stage.scale }
          : { "--nx": `${nx}px`, "--ny": `${ny}px`, width: stage.w, height: stage.h, left: stage.x, top: stage.y, transform: `scale(${stage.scale})` }}
      >
        <div className="sky" style={{ background: sky }} />
        <Stars opacity={stars} />
        {prev && <div className="layer layer-out" key={"out" + prev.n}>{render(prev.slide)}</div>}
        <div className="layer layer-in" key={"in" + slides.n}>{render(slides.cur)}</div>
        {!onBoard && <Bar next={minyanim[0]} tz={tz} now={now} logos={slides.cur.kind !== "logo"} />}
        <BigClock tz={tz} />
        {dim > 0 && <div className="night-dim" style={{ opacity: dim }} />}
      </div>
    </div>
  );
}

const DRIFT = [[0, 0], [5, 0], [5, 4], [0, 4], [-5, 4], [-5, 0], [-5, -4], [0, -4], [5, -4]];

// The same quiet sky every night, faded in as it gets dark.
const STARS = (() => {
  let seed = 5779;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 170 }, () => ({ x: rnd() * 1920, y: rnd() * rnd() * 860, r: 0.7 + rnd() * rnd() * 1.6, o: 0.25 + rnd() * 0.6 }));
})();

function Stars({ opacity }) {
  if (opacity <= 0) return null;
  return (
    <svg className="stars" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" style={{ opacity }} aria-hidden="true">
      {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F6F2E9" opacity={s.o} />)}
    </svg>
  );
}

// One clock for the whole show: a monument on the board, and it glides down
// to the corner when a photo or flyer takes the wall.
function BigClock({ tz }) {
  const now = useNow(1000);
  const f = formatEpoch(now, tz);
  return <div className="bigclock"><span className="bc-time">{f.time}</span><span className="bc-side"><span className="bc-ampm">{f.ampm}</span><span className="bc-sec">{String(new Date(now).getSeconds()).padStart(2, "0")}</span></span></div>;
}

// Fully load and decode images (kept in a small cache); gives up after 3s so a
// slow image can never stall the rotation.
const decoded = new Map();
function predecode(urls) {
  const jobs = urls.map((u) => {
    if (!decoded.has(u)) {
      const img = new Image();
      img.decoding = "async";
      img.src = u;
      const job = (img.decode ? img.decode() : new Promise((r) => { img.onload = r; img.onerror = r; })).catch(() => {}).then(() => img);
      decoded.set(u, job);
      if (decoded.size > 40) decoded.delete(decoded.keys().next().value);
    }
    return decoded.get(u);
  });
  return Promise.race([Promise.all(jobs), new Promise((r) => setTimeout(r, 3000))]);
}

// Dim the screen overnight so it isn't a floodlight in an empty room.
function nightDim(s, now, tz) {
  const n = s.nightDim;
  if (!n?.enabled || !n.start || !n.end) return 0;
  const p = localInfo(now, tz);
  const mins = p.hour * 60 + p.minute;
  const [sh, sm] = n.start.split(":").map(Number);
  const [eh, em] = n.end.split(":").map(Number);
  const a = sh * 60 + sm, b = eh * 60 + em;
  const inside = a < b ? mins >= a && mins < b : mins >= a || mins < b;
  return inside ? Math.min(0.85, Math.max(0, 1 - (Number(n.level) || 40) / 100)) : 0;
}
