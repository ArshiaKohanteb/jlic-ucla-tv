// A minyan here is never a given: ten people vote in the group chat the night
// before, and the time and room can move. Each weekday minyan keeps a `live`
// record for one date ({ date, state, count, time, place }), set from the
// dashboard. It only counts on that date, so every day starts fresh.
// A minyan with a `date` is a one-time minyan an admin set up for that day.
// The count is everyone signed up on the site, plus any extras added by an admin.
import { activeSpecial, localInfo, addDays, resolveTime, zonedEpoch, TIMEZONE } from "./schedule.js";
import { signupList } from "./signups.js";

export const TEN = 10;
const STILL_ON_MS = 45 * 60_000; // a minyan stays on the board this long after it starts

export const liveFor = (m, date) => (m.live?.date === date ? m.live : null);

function weekdayOf(date) {
  return new Date(date + "T12:00:00Z").getUTCDay();
}

function dayLabel(date, today) {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));
}

// With suggested times, each person votes for any that work and the leading time
// is the minyan's time (earliest wins a tie). Once an admin picks a time, only the
// people who said yes to it count. Anyone who signed up before there was a poll
// counts for the usual time.
export function pollOf(m, live, people) {
  const times = [...new Set(live?.options?.length ? live.options : m.options || [])].filter(Boolean).sort();
  if (times.length < 2) return { options: null, going: people, time: live?.time || times[0] || "", times };
  const planned = m.time?.type === "fixed" ? m.time.value : "";
  const voters = (t) => people.filter((p) => (p.times ? !!p.times[t] : t === planned));
  const options = times.map((t) => {
    const list = voters(t);
    return { t, people: list, count: list.filter((p) => p.counts !== false).length };
  });
  if (live?.time) return { options, going: voters(live.time), time: live.time, times };
  const lead = options.reduce((best, x) => (x.count > best.count ? x : best), options[0]);
  return { options, going: lead.people, time: lead.t, times };
}

function read(m, date, z, tz, now, today, signups, { autoConfirm = true, closeAt = "" } = {}) {
  const live = liveFor(m, date);
  const planned = m.time?.type === "fixed" ? m.time.value : "";
  const fixedEpoch = live?.time ? zonedEpoch(date, live.time, tz) : resolveTime(m.time, date, z, tz);
  const people = signupList(signups, date, m.id);
  const extra = Math.max(0, Number(live?.count) || 0);
  const { options, going, time, times } = pollOf(m, live, people);
  const epoch = !live?.time && time ? zonedEpoch(date, time, tz) : fixedEpoch;
  const count = Math.min(TEN, going.filter((p) => p.counts !== false).length + extra);
  const off = live?.state === "off";
  const on = !off && (live?.state === "on" || (autoConfirm && count >= TEN));
  const started = on && epoch != null && now >= epoch;
  return {
    id: m.id, name: m.name, date, epoch, count, on, off, started,
    known: !!live || people.length > 0,
    people,
    going,
    options: live?.time ? null : options?.map((x) => ({ ...x, epoch: zonedEpoch(date, x.t, tz) })) || null,
    planned,
    times: times || [],
    votes: options?.map((x) => ({ ...x, epoch: zonedEpoch(date, x.t, tz) })) || null,
    state: live?.state || "voting",
    locked: live?.time || "",
    auto: !m.date,
    extra,
    place: live?.place || m.place || "",
    message: live?.message || "",
    perk: live?.perk || m.perk || "",
    closes: closeAt && date > today ? zonedEpoch(addDays(date, -1), closeAt, tz) : null,
    needsReader: /shach/i.test(m.name || "") && [1, 4].includes(weekdayOf(date)),
    reader: going.find((p) => p.reads)?.name || "",
    leader: going.find((p) => p.leads)?.name || "",
    note: m.note || "",
    day: dayLabel(date, today),
    need: TEN - count,
    item: m,
  };
}

// The status line, in the group chat's own words.
export function statusWords(o) {
  if (o.off) return { big: "Not today", small: "Next time" };
  if (o.started) return { big: "Davening now", small: "Come on in" };
  if (o.on) return { big: "We're on", small: "Super optimal" };
  if (!o.known) return { big: "Not confirmed", small: "Vote at uclaminyan.com/vote" };
  const small = o.need === 1 ? "Who's the final tzadik?" : o.need === 5 ? "Halfway there" : `${o.need} more`;
  return { big: `${o.need * 10}% to go`, small };
}

const runsOn = (m, date) => (m.date ? m.date === date : (m.days || []).includes(weekdayOf(date)));

// Every minyan in the coming days, soonest first.
export function minyanCalendar(tv, z, now = Date.now(), tz = TIMEZONE, signups = {}, days = 8) {
  const today = localInfo(now, tz).dateKey;
  const found = [];
  for (const m of tv.minyanim || []) {
    for (let i = 0; i < days; i++) {
      const date = addDays(today, i);
      if (!runsOn(m, date)) continue;
      if (!m.date && (z?.calendar?.[date]?.assur || activeSpecial(tv, date))) continue;
      const o = read(m, date, z, tz, now, today, signups, { autoConfirm: tv.settings?.autoConfirm !== false, closeAt: tv.settings?.pollClose ?? "22:30" });
      // A minyan with no time yet stays up all day; one that was called off drops off at its time.
      if (o.epoch != null && now > o.epoch + (o.off ? 0 : STILL_ON_MS)) continue;
      found.push(o);
    }
  }
  const at = (o) => o.epoch ?? zonedEpoch(o.date, "23:59", tz);
  return found.sort((a, b) => at(a) - at(b));
}

// The vote stays open after the deadline for a last-minute tenth, but the
// countdown is what gets people to answer the night before.
export function closeWords(o, now) {
  if (!o.closes || o.on || o.off) return "";
  const m = Math.ceil((o.closes - now) / 60_000);
  if (m <= 0) return "Last call";
  if (m > 12 * 60) return "";
  if (m < 60) return `Closes in ${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return `Closes in ${h} hr${r ? ` ${r} min` : ""}`;
}

export function needWords(o) {
  if (o.off || o.on || !o.known) return "";
  if (o.need === 1) return "One more needed";
  if (o.need === 2) return "Two more needed";
  return "";
}

// From half an hour before until it should be over, people can check in.
export const canCheckIn = (o, now) => !o.off && o.epoch != null && now >= o.epoch - 30 * 60_000 && now <= o.epoch + 60 * 60_000;

// How often this person came: every past sign-up, and days in a row.
export function myRecord(signups, uid, today) {
  const dates = Object.keys(signups || {}).filter((d) => d < today && Object.values(signups[d]).some((list) => list[uid])).sort();
  let streak = 0, day = addDays(today, -1);
  for (let i = dates.length - 1; i >= 0;) {
    const wd = weekdayOf(day);
    if (dates[i] === day) { streak += 1; i -= 1; } else if (wd !== 6) break;
    day = addDays(day, -1);
  }
  return { count: dates.length, streak };
}

// Who has come most this calendar month, for the TV.
export function monthLeader(signups, today) {
  const counts = new Map();
  for (const [d, polls] of Object.entries(signups || {})) {
    if (d >= today || d.slice(0, 7) !== today.slice(0, 7)) continue;
    for (const list of Object.values(polls)) for (const [uid, p] of Object.entries(list)) {
      counts.set(uid, { name: p.name, n: (counts.get(uid)?.n || 0) + 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n)[0] || null;
}

// When it starts, said the way someone would say it across the room.
export function whenWords(o, now) {
  if (o.off || o.epoch == null || o.day !== "Today") return { text: o.day, soon: false };
  const m = Math.ceil((o.epoch - now) / 60_000);
  if (m <= 0) return { text: o.on ? "Davening now" : "Now", soon: true };
  if (m > 120) return { text: o.day, soon: false };
  if (m === 1) return { text: "In 1 minute", soon: true };
  if (m < 60) return { text: `In ${m} minutes`, soon: m <= 15 };
  const h = Math.floor(m / 60), r = m % 60;
  return { text: `In ${h} hr${r ? ` ${r} min` : ""}`, soon: false };
}

// The next time each minyan comes up.
export function upcomingMinyanim(tv, z, now = Date.now(), tz = TIMEZONE, limit = 2, signups = {}) {
  const seen = new Set();
  return minyanCalendar(tv, z, now, tz, signups).filter((o) => !seen.has(o.id) && seen.add(o.id)).slice(0, limit);
}
