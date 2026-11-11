// The record of who came. Nobody takes attendance, so sign-ups stand in for it:
// a past minyan is built from who signed up, and anything an admin changes is
// stored as a correction at /attendance/{date}/{minyanId}, so the original
// sign-ups are never rewritten.
import { onValue, ref, set, remove } from "firebase/database";
import { db } from "./firebase.js";
import { isDemo } from "./store.js";
import { signupList } from "./signups.js";
import { liveFor, pollOf, TEN } from "./minyan.js";

const DEMO_KEY = "jlic-attendance-demo";
const DEMO_EVENT = "jlic-attendance-change";
const readDemo = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "{}"); } catch { return {}; } };

export function subscribeAttendance(cb) {
  if (isDemo()) {
    const emit = () => cb(readDemo());
    emit();
    window.addEventListener(DEMO_EVENT, emit);
    return () => window.removeEventListener(DEMO_EVENT, emit);
  }
  return onValue(ref(db, "attendance"), (s) => cb(s.val() || {}), () => cb({}));
}

export function saveCorrection(date, id, value) {
  if (isDemo()) {
    const all = readDemo();
    if (value) (all[date] ||= {})[id] = value; else if (all[date]) delete all[date][id];
    localStorage.setItem(DEMO_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event(DEMO_EVENT));
    return Promise.resolve();
  }
  return value ? set(ref(db, `attendance/${date}/${id}`), value) : remove(ref(db, `attendance/${date}/${id}`));
}

export function buildLog(tv, signups, attendance, today) {
  const byId = new Map((tv.minyanim || []).map((m) => [m.id, m]));
  const keys = new Set();
  for (const [date, list] of Object.entries(signups || {})) if (date < today) Object.keys(list).forEach((id) => keys.add(`${date}|${id}`));
  for (const [date, list] of Object.entries(attendance || {})) Object.keys(list).forEach((id) => keys.add(`${date}|${id}`));
  const log = [...keys].map((key) => {
    const [date, id] = key.split("|");
    const m = byId.get(id) || { id };
    const a = attendance?.[date]?.[id] || {};
    const all = signupList(signups, date, id);
    // Each minyan keeps only its latest day's poll times, so an older day's
    // choices are read back from the times people voted for that day.
    const voted = [...new Set(all.flatMap((p) => Object.keys(p.times || {})))];
    const live = liveFor(m, date) || (voted.length ? { date, options: voted } : null);
    const { going, time } = pollOf(m, live, all);
    const here = all.filter((p) => p.here);
    const fixes = a.people || {};
    // Check-ins beat sign-ups: once anyone has scanned in, only the people who did count.
    const people = (here.length ? here : going).filter((p) => fixes[p.uid] !== false).map((p) => ({ key: p.uid, name: p.name, counts: p.counts !== false, late: !!p.late }));
    for (const [k, v] of Object.entries(fixes)) if (v && !people.some((p) => p.key === k)) people.push({ key: k, name: v.name, counts: v.counts !== false, added: true });
    const extra = a.extra ?? Number(live?.count) ?? 0;
    const total = people.filter((p) => p.counts).length + (extra || 0);
    const held = a.held ?? (live?.state === "off" ? false : live?.state === "on" || total >= TEN);
    const planned = m.time?.type === "fixed" ? m.time.value : "";
    return { key, date, id, name: a.name || m.name || "Minyan", time: a.time || time || planned, place: a.place || live?.place || m.place || "", people, extra: extra || 0, total, held, manual: !!a.manual, edited: !!attendance?.[date]?.[id], correction: a };
  });
  return log.sort((x, y) => (x.date === y.date ? (x.time < y.time ? 1 : -1) : x.date < y.date ? 1 : -1));
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Shabbat"];

export function buildStats(log, today) {
  const held = log.filter((e) => e.held);
  const oldestFirst = [...held].reverse();
  const people = new Map();
  oldestFirst.forEach((e, i) => {
    for (const p of e.people) {
      const r = people.get(p.key) || { key: p.key, name: p.name, count: 0, last: "", shacharit: 0, mincha: 0, lastIndex: -2, streak: 0, best: 0 };
      r.name = p.name;
      r.count += 1;
      r.last = e.date;
      if (/shach/i.test(e.name)) r.shacharit += 1;
      if (/mincha/i.test(e.name)) r.mincha += 1;
      r.streak = r.lastIndex === i - 1 ? r.streak + 1 : 1;
      r.best = Math.max(r.best, r.streak);
      r.lastIndex = i;
      people.set(p.key, r);
    }
  });
  const last = held.length - 1;
  const board = [...people.values()].map((r) => ({ ...r, current: r.lastIndex === last ? r.streak : 0 })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const attended = held.reduce((n, e) => n + e.total, 0);
  const days = {};
  for (const e of held) { const d = WEEKDAYS[new Date(e.date + "T12:00:00Z").getUTCDay()]; days[d] = (days[d] || 0) + 1; }
  const busiest = Object.entries(days).sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  const month = today.slice(0, 7);
  return {
    held: held.length,
    missed: log.length - held.length,
    attended,
    average: held.length ? Math.round((attended / held.length) * 10) / 10 : 0,
    people: board.length,
    biggest: held.reduce((best, e) => (e.total > (best?.total || 0) ? e : best), null),
    busiest,
    thisMonth: held.filter((e) => e.date.startsWith(month)).length,
    shacharit: held.filter((e) => /shach/i.test(e.name)).length,
    mincha: held.filter((e) => /mincha/i.test(e.name)).length,
    board,
    streak: [...board].sort((a, b) => b.best - a.best)[0] || null,
  };
}
