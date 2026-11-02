// Turns stored schedule items into real times for a given day.

export const TIMEZONE = "America/Los_Angeles";

export const ZMAN_CHOICES = [
  { id: "sunrise", label: "Sunrise" },
  { id: "hatzot", label: "Midday (Chatzot)" },
  { id: "minchaGedola", label: "Mincha Gedola" },
  { id: "plag", label: "Plag HaMincha" },
  { id: "sunset", label: "Sunset" },
  { id: "tzet", label: "Nightfall (Tzet)" },
  { id: "alot", label: "Dawn (Alot)" },
  { id: "misheyakir", label: "Misheyakir" },
  { id: "candleLighting", label: "Candle Lighting", shabbat: true },
  { id: "havdalah", label: "Havdalah", shabbat: true },
  { id: "rabbeinuTam", label: "Rabbeinu Tam", shabbat: true },
];

const partsFmt = new Map();
function parts(epoch, tz) {
  if (!partsFmt.has(tz)) {
    partsFmt.set(tz, new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    }));
  }
  const o = {};
  for (const p of partsFmt.get(tz).formatToParts(epoch)) o[p.type] = p.value;
  return o;
}

const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localInfo(epoch, tz = TIMEZONE) {
  const p = parts(epoch, tz);
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    weekday: WD[p.weekday],
    hour: +p.hour,
    minute: +p.minute,
    second: +p.second,
  };
}

export function addDays(dateKey, n) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

// Epoch for a wall-clock time on a date in the shul's timezone.
export function zonedEpoch(dateKey, hhmm, tz = TIMEZONE) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = String(hhmm || "0:0").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let epoch = guess;
  for (let i = 0; i < 2; i++) {
    const p = parts(epoch, tz);
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    epoch += guess - asUtc;
  }
  return epoch;
}

export function resolveTime(spec, dateKey, z, tz = TIMEZONE) {
  if (!spec) return null;
  if (spec.type === "fixed") return spec.value ? zonedEpoch(dateKey, spec.value, tz) : null;
  if (spec.type === "zman" && z) {
    let base = null;
    if (spec.zman === "candleLighting" || spec.zman === "havdalah" || spec.zman === "rabbeinuTam") base = z[spec.zman];
    else base = z.days?.[dateKey]?.[spec.zman] ?? null;
    if (base == null) return null;
    let t = base + (Number(spec.offset) || 0) * 60_000;
    const r = Number(spec.round) || 0;
    if (r > 0) t = Math.floor(t / (r * 60_000)) * r * 60_000;
    else t = Math.floor(t / 60_000) * 60_000;
    return t;
  }
  return null;
}

export function describeTime(spec) {
  if (!spec) return "";
  if (spec.type === "fixed") return formatHHMM(spec.value);
  const z = ZMAN_CHOICES.find((c) => c.id === spec.zman)?.label || spec.zman;
  const off = Number(spec.offset) || 0;
  const rel = off === 0 ? `At ${z}` : `${Math.abs(off)} min ${off < 0 ? "before" : "after"} ${z}`;
  return spec.round ? `${rel}, rounded down to ${spec.round} min` : rel;
}

export function formatHHMM(v) {
  if (!v) return "";
  const [h, m] = v.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

let HOUR24 = false;
export const setHour24 = (v) => { HOUR24 = !!v; };

// { time: "6:30", ampm: "PM" }
export function formatEpoch(epoch, tz = TIMEZONE, withSeconds = false) {
  if (epoch == null) return { time: "—", ampm: "" };
  const p = localInfo(epoch, tz);
  if (HOUR24) {
    return { time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}${withSeconds ? ":" + String(p.second).padStart(2, "0") : ""}`, ampm: "" };
  }
  const h = ((p.hour + 11) % 12) + 1;
  const time = `${h}:${String(p.minute).padStart(2, "0")}${withSeconds ? ":" + String(p.second).padStart(2, "0") : ""}`;
  return { time, ampm: p.hour < 12 ? "AM" : "PM" };
}

export const fmt = (epoch, tz) => {
  const f = formatEpoch(epoch, tz);
  return f.ampm ? `${f.time} ${f.ampm}` : f.time;
};

const inRange = (dateKey, start, end) => (!start || dateKey >= start) && (!end || dateKey <= end);

export function activeSpecial(tv, dateKey) {
  return (tv.special || []).find((s) => s.active !== false && s.start && inRange(dateKey, s.start, s.end || s.start));
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Shabbat"];

const timed = (items, dateKey, z, tz) => (items || [])
  .map((m) => ({ ...m, epoch: resolveTime(m.time, dateKey, z, tz) }))
  .filter((m) => m.epoch != null)
  .sort((a, b) => a.epoch - b.epoch);

const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

// Everything the schedule screen needs for "now". The timetable is a list of
// groups (today, holiday days, the coming Shabbat or Yom Tov), each titled.
// Holidays come from the zmanim engine, so Yom Tov never borrows Shabbat labels.
export function buildSchedule(tv, z, now = Date.now(), tz = TIMEZONE) {
  const info = localInfo(now, tz);
  const today = info.dateKey;
  const wd = info.weekday;
  const cal = z?.calendar?.[today] || {};
  const zToday = z?.days?.[today] || {};
  const groups = [];

  // The coming Shabbat / Yom Tov as one period (from the engine, or plain Shabbat).
  const satKey = addDays(today, (6 - wd + 7) % 7);
  let P = z?.melakha || { start: satKey, end: satKey, title: "Shabbat", titleHe: "שבת", greeting: "Shabbat Shalom", greetingHe: "שבת שלום", endLabel: "Havdalah", isYomTov: false };
  if (z?.havdalah && now > z.havdalah) P = null; // Saturday night: it's over until the engine rolls forward
  const periodSub = z?.parasha ? `פרשת ${z.parasha}` : P?.isYomTov ? P.titleHe : "";
  const erevItems = (tv.shabbat || []).filter((x) => x.day === "fri");
  const dayItems = (tv.shabbat || []).filter((x) => x.day !== "fri");

  const assurToday = cal.assur ?? wd === 6;
  const special = activeSpecial(tv, today);
  if (special) {
    groups.push({ key: "special-" + today, title: special.title || "Today", subtitle: cal.holiday?.he || "Today", items: timed(special.items, today, z, tz) });
  } else if (assurToday) {
    const title = cal.yomTov && cal.holiday ? cal.holiday.name : P?.title || "Shabbat";
    groups.push({ key: "assur-" + today, title, subtitle: cal.yomTov && cal.holiday ? cal.holiday.he : periodSub, items: timed(dayItems, today, z, tz) });
  } else {
    const items = timed((tv.minyanim || []).filter((m) => (m.days || []).includes(wd)), today, z, tz);
    if (cal.holiday?.kind === "fast" && zToday.tzet && !/Kippur/.test(cal.holiday.name)) {
      items.push({ id: "fast-ends", name: "Fast ends", epoch: zToday.tzet });
    }
    if (items.length) groups.push({ key: "today", title: "Today", subtitle: cal.holiday?.name || WEEKDAY_NAMES[wd], items });
  }

  // Look ahead to the period: Shabbat from the "show from" weekday, Yom Tov two days out.
  const showFrom = Number(tv.settings?.shabbatShowFrom ?? 4);
  const until = P ? dayDiff(today, P.start) : 99;
  const lookAhead = P && until > 0 && (P.isYomTov ? until <= 2 : showFrom === 0 || wd === 5 || wd >= showFrom || until <= 1);
  if (lookAhead) {
    for (let d = addDays(today, 1); d <= P.end; d = addDays(d, 1)) {
      const sp = activeSpecial(tv, d);
      if (sp) {
        const dc = z?.calendar?.[d];
        groups.push({ key: "special-" + d, title: sp.title || dc?.holiday?.name || "Special Schedule", subtitle: WEEKDAY_NAMES[localInfo(zonedEpoch(d, "12:00", tz), tz).weekday], items: timed(sp.items, d, z, tz) });
      }
    }
    if (!activeSpecial(tv, P.start)) {
      const erev = addDays(P.start, -1);
      const items = [
        ...(special && erev === today ? [] : timed(erevItems, erev, z, tz)),
        ...timed(dayItems, P.start, z, tz),
      ].sort((a, b) => a.epoch - b.epoch);
      if (items.length) groups.push({ key: "period", title: P.title, subtitle: periodSub, items });
    }
  }

  // Candle lighting and havdalah live in the bottom bar, not in the timetable.
  const barOnly = (m) => /candle\s*-?\s*light|havdal/i.test(m.name || "") || ["candleLighting", "havdalah"].includes(m.zman);
  for (const g of groups) g.items = g.items.filter((m) => !barOnly(m));
  for (let i = groups.length - 1; i >= 0; i--) if (!groups[i].items.length) groups.splice(i, 1);

  const all = groups.flatMap((g) => g.items).sort((a, b) => a.epoch - b.epoch);

  const next = all.find((m) => m.epoch > now) || null;

  const isNight = zToday.sunset && zToday.sunrise ? now > zToday.sunset || now < zToday.sunrise : false;
  const inPeriod = !!(P && z?.candleLighting && z?.havdalah && now >= z.candleLighting && now <= z.havdalah);

  let greeting = null;
  if (inPeriod) greeting = { en: P.greeting, he: P.greetingHe };
  else if (cal.holiday && cal.holiday.kind !== "fast" && cal.holiday.greeting) greeting = { en: cal.holiday.greeting, he: cal.holiday.he };
  else if (cal.holiday?.kind === "fast") greeting = { en: cal.holiday.greeting || cal.holiday.name, he: cal.holiday.he };
  else if (wd === 5 && zToday.hatzot && now > zToday.hatzot) greeting = { en: "Shabbat Shalom", he: "שבת שלום" };

  return {
    today, weekday: wd, special, groups, upcoming: all.filter((m) => m.epoch > now), next, isNight,
    isShabbat: inPeriod, inPeriod, period: P, holidayToday: cal.holiday || null, greeting,
  };
}

export function minutesUntil(epoch, now = Date.now()) {
  return Math.ceil((epoch - now) / 60_000);
}

export function isLive(item, today) {
  if (item.active === false) return false;
  return inRange(today, item.start, item.end);
}
