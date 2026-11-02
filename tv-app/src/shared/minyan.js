// A minyan here is never a given: ten people vote in the group chat the night
// before, and the time and room can move. Each weekday minyan keeps a `live`
// record for one date ({ date, state, count, time, place }), set from the
// dashboard. It only counts on that date, so every day starts fresh.
import { activeSpecial, localInfo, addDays, resolveTime, zonedEpoch, TIMEZONE } from "./schedule.js";

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

function read(m, date, z, tz, now, today) {
  const live = liveFor(m, date);
  const epoch = live?.time ? zonedEpoch(date, live.time, tz) : resolveTime(m.time, date, z, tz);
  const count = Math.min(TEN, Math.max(0, Number(live?.count) || 0));
  const off = live?.state === "off";
  const on = !off && (live?.state === "on" || count >= TEN);
  const started = on && epoch != null && now >= epoch;
  return {
    id: m.id, name: m.name, date, epoch, count, on, off, started,
    known: !!live,
    place: live?.place || "",
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
  if (!o.known) return { big: "Not confirmed", small: "Vote in the group chat" };
  const small = o.need === 1 ? "Who's the final tzadik?" : o.need === 5 ? "Halfway there" : `${o.need} more votes`;
  return { big: `${o.need * 10}% to go`, small };
}

// The next time each weekday minyan comes up, soonest first.
export function upcomingMinyanim(tv, z, now = Date.now(), tz = TIMEZONE, limit = 2) {
  const today = localInfo(now, tz).dateKey;
  const found = [];
  for (const m of tv.minyanim || []) {
    for (let i = 0; i < 8; i++) {
      const date = addDays(today, i);
      if (!(m.days || []).includes(weekdayOf(date))) continue;
      if (z?.calendar?.[date]?.assur || activeSpecial(tv, date)) continue;
      const o = read(m, date, z, tz, now, today);
      // A minyan with no time yet stays up all day; one that was called off drops off at its time.
      if (o.epoch != null && now > o.epoch + (o.off ? 0 : STILL_ON_MS)) continue;
      found.push(o);
      break;
    }
  }
  const at = (o) => o.epoch ?? zonedEpoch(o.date, "23:59", tz);
  return found.sort((a, b) => at(a) - at(b)).slice(0, limit);
}
