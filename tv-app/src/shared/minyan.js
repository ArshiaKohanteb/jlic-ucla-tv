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

function read(m, date, z, tz, now, today, signups) {
  const live = liveFor(m, date);
  const epoch = live?.time ? zonedEpoch(date, live.time, tz) : resolveTime(m.time, date, z, tz);
  const people = signupList(signups, date, m.id);
  const extra = Math.max(0, Number(live?.count) || 0);
  const count = Math.min(TEN, people.filter((p) => p.counts !== false).length + extra);
  const off = live?.state === "off";
  const on = !off && (live?.state === "on" || count >= TEN);
  const started = on && epoch != null && now >= epoch;
  return {
    id: m.id, name: m.name, date, epoch, count, on, off, started,
    known: !!live || people.length > 0,
    people,
    extra,
    place: live?.place || m.place || "",
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
  if (!o.known) return { big: "Not confirmed", small: "Sign up at uclaminyan.com" };
  const small = o.need === 1 ? "Who's the final tzadik?" : o.need === 5 ? "Halfway there" : `${o.need} more at uclaminyan.com`;
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
      const o = read(m, date, z, tz, now, today, signups);
      // A minyan with no time yet stays up all day; one that was called off drops off at its time.
      if (o.epoch != null && now > o.epoch + (o.off ? 0 : STILL_ON_MS)) continue;
      found.push(o);
    }
  }
  const at = (o) => o.epoch ?? zonedEpoch(o.date, "23:59", tz);
  return found.sort((a, b) => at(a) - at(b));
}

// The next time each minyan comes up.
export function upcomingMinyanim(tv, z, now = Date.now(), tz = TIMEZONE, limit = 2, signups = {}) {
  const seen = new Set();
  return minyanCalendar(tv, z, now, tz, signups).filter((o) => !seen.has(o.id) && seen.add(o.id)).slice(0, limit);
}
