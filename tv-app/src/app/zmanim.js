// The zmanim on the home page. The "Hillel" times are the ones the TV shows (Rabbi
// Ovadia Yosef's, from royzmanim.com through the zmanim bridge); every other opinion is
// worked out here from the sun's position with the bundled KosherZmanim library.
import { TIMEZONE, addDays } from "../shared/schedule.js";

const PLACE = { name: "Hillel at UCLA", lat: 34.070693, long: -118.438491, elevation: 0 };
const MIN = 60_000;

let lib = null;
export const loadLib = () => (lib ||= import(/* @vite-ignore */ `${import.meta.env.BASE_URL}assets/libraries/kosherZmanim/kosher-zmanim.js`));

export const MINHAGIM = [
  { id: "hillel", label: "Hillel", note: "The times on the Hillel TV: Rabbi Ovadia Yosef, from royzmanim.com." },
  { id: "gra", label: "GRA", note: "GRA: the day runs from sunrise to sunset." },
  { id: "mga", label: "MGA", note: "Magen Avraham: the day runs from 72 minutes before sunrise to 72 after sunset." },
  { id: "chabad", label: "Chabad", note: "Baal HaTanya: the day runs from the sun's true rise to its true set." },
];

// Which opinion each minhag goes by, per zman. "roy" means the TV's own time.
const PICK = {
  hillel: { alot: "roy", misheyakir: "roy", sunrise: "roy", shema: "roy", tefila: "roy", hatzot: "roy", minchaGedola: "roy", minchaKetana: "gra", plag: "roy", candles: "roy", sunset: "roy", tzet: "roy", rt: "roy", midnight: "roy" },
  gra: { alot: "16.1", misheyakir: "10.2", sunrise: "sea", shema: "gra", tefila: "gra", hatzot: "astro", minchaGedola: "gra30", minchaKetana: "gra", plag: "gra", candles: "18", sunset: "sea", tzet: "8.5", rt: "72", midnight: "astro" },
  mga: { alot: "72", misheyakir: "11.5", sunrise: "sea", shema: "mga", tefila: "mga", hatzot: "astro", minchaGedola: "gra30", minchaKetana: "mga", plag: "mga", candles: "18", sunset: "sea", tzet: "72", rt: "72", midnight: "astro" },
  chabad: { alot: "chabad", misheyakir: "chabad", sunrise: "sea", shema: "chabad", tefila: "chabad", hatzot: "astro", minchaGedola: "chabad", minchaKetana: "chabad", plag: "chabad", candles: "18", sunset: "sea", tzet: "chabad", rt: "72", midnight: "astro" },
};

// Every zman on the page, in order. `later` rounds up to the minute (wait until), the rest round down.
export const ZMANIM = [
  { id: "alot", part: "morning", label: "Dawn", sub: "Alot HaShachar", note: "The first light. The day begins for some mitzvot." },
  { id: "misheyakir", part: "morning", label: "Earliest Tallit & Tefillin", sub: "Misheyakir", note: "Light enough to recognize a friend.", later: true },
  { id: "sunrise", part: "morning", label: "Sunrise", sub: "Netz HaChama", note: "The best time to start the Amida of Shacharit.", later: true },
  { id: "shema", part: "morning", label: "Latest Shema", sub: "Sof Zman Kriat Shema", note: "Say Shema by now: three hours into the day." },
  { id: "tefila", part: "morning", label: "Latest Shacharit", sub: "Sof Zman Tefila", note: "Finish the Amida of Shacharit by now: four hours into the day." },
  { id: "hatzot", part: "afternoon", label: "Midday", sub: "Chatzot HaYom", note: "The middle of the day. Shacharit's Amida should be done before." },
  { id: "minchaGedola", part: "afternoon", label: "Earliest Mincha", sub: "Mincha Gedola", note: "Half an hour after midday.", later: true },
  { id: "minchaKetana", part: "afternoon", label: "Mincha Ketana", sub: "Mincha Ketana", note: "Two and a half hours before the end of the day. The preferred time for Mincha starts here.", later: true },
  { id: "plag", part: "afternoon", label: "Plag HaMincha", sub: "Plag HaMincha", note: "From here, some daven Arvit early and light Shabbat candles.", later: true },
  { id: "candles", part: "evening", label: "Candle Lighting", sub: "Hadlakat Nerot", note: "Light Shabbat candles by now.", friday: true },
  { id: "sunset", part: "evening", label: "Sunset", sub: "Shkia", note: "Daven Mincha before sunset." },
  { id: "tzet", part: "evening", label: "Nightfall", sub: "Tzeit HaKochavim", note: "Three stars are out. The next day begins.", later: true },
  { id: "rt", part: "evening", label: "Rabbeinu Tam", sub: "Tzeit Rabbeinu Tam", note: "A stricter nightfall. Many wait for it when Shabbat ends.", later: true },
  { id: "midnight", part: "evening", label: "Halachic Midnight", sub: "Chatzot HaLayla", note: "Finish the night's Shema and Arvit by now, ideally.", later: true },
];
export const PARTS = [
  { id: "morning", label: "Morning", he: "בוקר" },
  { id: "afternoon", label: "Afternoon", he: "צהריים" },
  { id: "evening", label: "Evening", he: "ערב" },
];
export const DEFAULT_PREFS = { minhag: "hillel", h24: false, shaah: false, hidden: ["midnight"] };

const ms = (zdt) => (zdt && typeof zdt.epochMilliseconds === "number" ? zdt.epochMilliseconds : null);
const round = (t, later) => (t == null ? null : later ? Math.ceil(t / MIN) * MIN : Math.floor(t / MIN) * MIN);
// A time `hours` shaot zmaniyot into a day that runs from `start` to `end`.
const into = (start, end, hours) => (start == null || end == null ? null : start + ((end - start) / 12) * hours);

// The bridge's ids for each of ours.
const ROY = { alot: "alot", misheyakir: "misheyakir", sunrise: "sunrise", shema: "shemaGRA", tefila: "tefila", hatzot: "hatzot", minchaGedola: "minchaGedola", plag: "plag", sunset: "sunset", tzet: "tzet", midnight: "midnight" };

// All the opinions for one day: { [zmanId]: [{ id, label, at }] }, plus the length of an hour.
export function opinionsFor(K, date, bridge) {
  const geo = new K.GeoLocation(PLACE.name, PLACE.lat, PLACE.long, PLACE.elevation, TIMEZONE);
  const c = new K.ZmanimCalendar(geo);
  c.setDate(K.Temporal.PlainDate.from(date));
  const below = (deg) => ms(c.getSunriseOffsetByDegrees(90 + deg));
  const after = (deg) => ms(c.getSunsetOffsetByDegrees(90 + deg));
  const rise = ms(c.getSeaLevelSunrise());
  const set = ms(c.getSeaLevelSunset());
  const noon = ms(c.getSunTransit());
  const midnight = ms(c.getSolarMidnight());
  const mga = [rise - 72 * MIN, set + 72 * MIN];
  const chabad = [below(1.583), after(1.583)];
  const hour = (set - rise) / 12;
  const roy = bridge?.days?.[date] || null;
  const fri = new Date(date + "T12:00:00Z").getUTCDay() === 5;
  const royCandles = fri && bridge?.candleLighting && Math.abs(bridge.candleLighting - set) < 2 * 3600_000 ? bridge.candleLighting : null;
  const royRT = bridge?.rabbeinuTam && Math.abs(bridge.rabbeinuTam - set) < 3 * 3600_000 ? bridge.rabbeinuTam : null;

  const list = {
    alot: [["16.1", "16.1°", below(16.1)], ["72", "72 minutes", rise - 72 * MIN], ["19.8", "19.8°", below(19.8)], ["chabad", "Chabad (16.9°)", below(16.9)]],
    misheyakir: [["10.2", "10.2°", below(10.2)], ["11", "11°", below(11)], ["11.5", "11.5°", below(11.5)], ["chabad", "Chabad (10.1°)", below(10.1)]],
    sunrise: [["sea", "Sea level", rise]],
    shema: [["gra", "GRA", into(rise, set, 3)], ["mga", "Magen Avraham", into(...mga, 3)], ["mga16", "Magen Avraham (16.1°)", into(below(16.1), after(16.1), 3)], ["chabad", "Chabad", into(...chabad, 3)]],
    tefila: [["gra", "GRA", into(rise, set, 4)], ["mga", "Magen Avraham", into(...mga, 4)], ["chabad", "Chabad", into(...chabad, 4)]],
    hatzot: [["astro", "Astronomical", noon]],
    minchaGedola: [["gra30", "Half an hour after midday", Math.max(into(rise, set, 6.5), noon + 30 * MIN)], ["gra", "GRA", into(rise, set, 6.5)], ["chabad", "Chabad", into(...chabad, 6.5)]],
    minchaKetana: [["gra", "GRA", into(rise, set, 9.5)], ["mga", "Magen Avraham", into(...mga, 9.5)], ["chabad", "Chabad", into(...chabad, 9.5)]],
    plag: [["gra", "GRA", into(rise, set, 10.75)], ["mga", "Magen Avraham", into(...mga, 10.75)], ["chabad", "Chabad", into(...chabad, 10.75)]],
    candles: fri ? [["18", "18 minutes before sunset", set - 18 * MIN], ["20", "20 minutes", set - 20 * MIN], ["40", "40 minutes (Jerusalem)", set - 40 * MIN]] : [],
    sunset: [["sea", "Sea level", set]],
    tzet: [["7.083", "7.083°", after(7.083)], ["8.5", "8.5°", after(8.5)], ["chabad", "Chabad (6°)", after(6)], ["50", "50 minutes", set + 50 * MIN], ["72", "72 minutes", set + 72 * MIN]],
    rt: [["72", "72 minutes", set + 72 * MIN], ["72z", "72 proportional minutes", set + hour * 1.2], ["16.1", "16.1°", after(16.1)]],
    midnight: [["astro", "Astronomical", midnight]],
  };
  const royAt = {
    ...Object.fromEntries(Object.entries(ROY).map(([id, key]) => [id, roy?.[key] ?? null])),
    candles: royCandles, rt: royRT ?? (roy ? set + hour * 1.2 : null),
  };
  const out = {};
  for (const z of ZMANIM) {
    const ops = (list[z.id] || []).map(([id, label, at]) => ({ id, label, at: round(at, z.later) }));
    if (royAt[z.id] != null && (!z.friday || fri)) ops.unshift({ id: "roy", label: "Rabbi Ovadia (Hillel TV)", at: royAt[z.id] });
    out[z.id] = ops;
  }
  return { opinions: out, hour, mgaHour: (mga[1] - mga[0]) / 12, fri };
}

// The rows to show: each zman with its time in this minhag and its other opinions.
export function rowsFor(K, date, bridge, prefs) {
  const { opinions, hour, mgaHour, fri } = opinionsFor(K, date, bridge);
  const pick = PICK[prefs.minhag] || PICK.hillel;
  const rows = [];
  for (const z of ZMANIM) {
    if (z.friday && !fri) continue;
    const ops = opinions[z.id];
    const main = ops.find((o) => o.id === pick[z.id]) || ops.find((o) => o.id !== "roy") || ops[0];
    if (!main || main.at == null) continue;
    const others = [];
    for (const o of ops) if (o !== main && o.at != null && !others.some((x) => x.at === o.at && x.label === o.label)) others.push(o);
    rows.push({ ...z, at: main.at, by: main.label, others });
  }
  return { rows, hour: prefs.minhag === "mga" ? mgaHour : hour };
}

// ── Dates ──

const HEB = [[400, "ת"], [300, "ש"], [200, "ר"], [100, "ק"], [90, "צ"], [80, "פ"], [70, "ע"], [60, "ס"], [50, "נ"], [40, "מ"], [30, "ל"], [20, "כ"], [10, "י"], [9, "ט"], [8, "ח"], [7, "ז"], [6, "ו"], [5, "ה"], [4, "ד"], [3, "ג"], [2, "ב"], [1, "א"]];
export function gematria(n) {
  let s = "";
  n %= 1000;
  for (const [v, l] of HEB) {
    if (n === 15 || n === 16) { s += n === 15 ? "טו" : "טז"; n = 0; break; }
    while (n >= v) { s += l; n -= v; if (n === 15 || n === 16) break; }
  }
  return s.length > 1 ? `${s.slice(0, -1)}״${s.slice(-1)}` : `${s}׳`;
}

const noonOf = (date) => new Date(date + "T20:00:00Z");
export function hebrewDate(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("he-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric", timeZone: TIMEZONE }).formatToParts(noonOf(date)).map((p) => [p.type, p.value]));
  const en = new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric", timeZone: TIMEZONE }).format(noonOf(date));
  const month = parts.month.replace(/^ב/, "");
  return { he: `${gematria(Number(parts.day))} ${month} ${gematria(Number(parts.year))}`, en: en.replace("Heshvan", "Cheshvan") };
}
export const civilDate = (date, opts = { weekday: "long", month: "short", day: "numeric", year: "numeric" }) =>
  new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));

// The days you can look at: today and the week ahead, the window the TV's engine covers.
export const weekFrom = (today) => Array.from({ length: 7 }, (_, i) => addDays(today, i));
