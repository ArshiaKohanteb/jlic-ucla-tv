// The zmanim on the home page, for UCLA or anywhere else.
// Sephardi times are Rabbi Ovadia Yosef's: at UCLA exactly what the Hillel TV shows (the zmanim
// bridge), elsewhere royzmanim.com's own calculator for that place. Every other opinion is worked
// out here from the sun's position with the bundled KosherZmanim library.
import { addDays } from "../shared/schedule.js";

const MIN = 60_000;
const BASE = import.meta.env?.BASE_URL || "/";
const ROY = "https://royzmanim.com/assets/";

export const UCLA = { id: "ucla", name: "UCLA", sub: "Hillel at UCLA", lat: 34.070693, long: -118.438491, elevation: 0, tz: "America/Los_Angeles" };
export const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";

let lib = null;
export const loadLib = () => (lib ||= import(/* @vite-ignore */ `${BASE}assets/libraries/kosherZmanim/kosher-zmanim.js`));

export const MINHAGIM = [
  { id: "sephardi", label: "Sephardi", note: "Rabbi Ovadia Yosef, from royzmanim.com. At UCLA, the same times as the Hillel TV." },
  { id: "gra", label: "GRA", note: "GRA: the day runs from sunrise to sunset." },
  { id: "mga", label: "MGA", note: "Magen Avraham: the day runs from 72 minutes before sunrise to 72 after sunset." },
  { id: "chabad", label: "Chabad", note: "Baal HaTanya: the day runs from the sun's true rise to its true set." },
];

// Which opinion each minhag goes by, per zman. "roy" is Rabbi Ovadia's time from royzmanim.com.
const PICK = {
  sephardi: { alot: "roy", misheyakir: "roy", sunrise: "roy", shema: "roy", tefila: "roy", hatzot: "roy", minchaGedola: "roy", minchaKetana: "gra", plag: "roy", candles: "roy", sunset: "roy", tzet: "roy", rt: "roy", midnight: "roy" },
  gra: { alot: "16.1", misheyakir: "10.2", sunrise: "sea", shema: "gra", tefila: "gra", hatzot: "astro", minchaGedola: "gra30", minchaKetana: "gra", plag: "gra", candles: "18", sunset: "sea", tzet: "8.5", rt: "72", midnight: "astro" },
  mga: { alot: "72", misheyakir: "11.5", sunrise: "sea", shema: "mga", tefila: "mga", hatzot: "astro", minchaGedola: "gra30", minchaKetana: "mga", plag: "mga", candles: "18", sunset: "sea", tzet: "72", rt: "72", midnight: "astro" },
  chabad: { alot: "chabad", misheyakir: "chabad", sunrise: "sea", shema: "chabad", tefila: "chabad", hatzot: "astro", minchaGedola: "chabad", minchaKetana: "chabad", plag: "chabad", candles: "18", sunset: "sea", tzet: "chabad", rt: "72", midnight: "astro" },
};

// Every zman on the page, in order. `later` rounds up to the minute (wait until), the rest round down.
export const ZMANIM = [
  { id: "alot", part: "morning", label: "Dawn", sub: "Alot HaShachar", he: "עלות השחר", note: "The first light. The day begins for some mitzvot." },
  { id: "misheyakir", part: "morning", label: "Earliest Tallit & Tefillin", sub: "Misheyakir", he: "משיכיר", note: "Light enough to recognize a friend.", later: true },
  { id: "sunrise", part: "morning", label: "Sunrise", sub: "Netz HaChama", he: "הנץ החמה", note: "The best time to start the Amida of Shacharit.", later: true },
  { id: "shema", part: "morning", label: "Latest Shema", sub: "Sof Zman Kriat Shema", he: "סוף זמן קריאת שמע", note: "Say Shema by now: three hours into the day." },
  { id: "tefila", part: "morning", label: "Latest Shacharit", sub: "Sof Zman Tefila", he: "סוף זמן תפילה", note: "Finish the Amida of Shacharit by now: four hours into the day." },
  { id: "hatzot", part: "afternoon", label: "Midday", sub: "Chatzot HaYom", he: "חצות היום", note: "The middle of the day. Shacharit's Amida should be done before." },
  { id: "minchaGedola", part: "afternoon", label: "Earliest Mincha", sub: "Mincha Gedola", he: "מנחה גדולה", note: "Half an hour after midday.", later: true },
  { id: "minchaKetana", part: "afternoon", label: "Mincha Ketana", sub: "Mincha Ketana", he: "מנחה קטנה", note: "Two and a half hours before the end of the day. The preferred time for Mincha starts here.", later: true },
  { id: "plag", part: "afternoon", label: "Plag HaMincha", sub: "Plag HaMincha", he: "פלג המנחה", note: "From here, some daven Arvit early and light Shabbat candles.", later: true },
  { id: "candles", part: "evening", label: "Candle Lighting", sub: "Hadlakat Nerot", he: "הדלקת נרות", note: "Light Shabbat candles by now.", friday: true },
  { id: "sunset", part: "evening", label: "Sunset", sub: "Shkia", he: "שקיעה", note: "Daven Mincha before sunset." },
  { id: "tzet", part: "evening", label: "Nightfall", sub: "Tzeit HaKochavim", he: "צאת הכוכבים", note: "Three stars are out. The next day begins.", later: true },
  { id: "rt", part: "evening", label: "Rabbeinu Tam", sub: "Tzeit Rabbeinu Tam", he: "רבנו תם", note: "A stricter nightfall. Many wait for it when Shabbat ends.", later: true },
  { id: "midnight", part: "evening", label: "Halachic Midnight", sub: "Chatzot HaLayla", he: "חצות הלילה", note: "Finish the night's Shema and Arvit by now, ideally.", later: true },
];
export const PARTS = [
  { id: "morning", label: "Morning", he: "בוקר" },
  { id: "afternoon", label: "Afternoon", he: "צהריים" },
  { id: "evening", label: "Evening", he: "ערב" },
];
export const DEFAULT_PREFS = { minhag: "sephardi", h24: false, shaah: false, hidden: ["midnight"], location: UCLA };

const ms = (zdt) => (zdt && typeof zdt.epochMilliseconds === "number" ? zdt.epochMilliseconds : null);
const round = (t, later) => (t == null ? null : later ? Math.ceil(t / MIN) * MIN : Math.floor(t / MIN) * MIN);
// A time `hours` shaot zmaniyot into a day that runs from `start` to `end`.
const into = (start, end, hours) => (start == null || end == null ? null : start + ((end - start) / 12) * hours);
const weekday = (date) => new Date(date + "T12:00:00Z").getUTCDay();
const near = (t, to, hours) => (t != null && to != null && Math.abs(t - to) < hours * 3600_000 ? t : null);

// ── Rabbi Ovadia's times ──

// At UCLA: the TV's own numbers. { [our id]: epoch }
const BRIDGE = { alot: "alot", misheyakir: "misheyakir", sunrise: "sunrise", shema: "shemaGRA", shemaMGA: "shemaMGA", tefila: "tefila", hatzot: "hatzot", minchaGedola: "minchaGedola", plag: "plag", sunset: "sunset", tzet: "tzet", midnight: "midnight" };
export function royFromBridge(bridge, date) {
  const d = bridge?.days?.[date];
  if (!d) return null;
  const out = Object.fromEntries(Object.entries(BRIDGE).map(([id, key]) => [id, d[key] ?? null]));
  out.candles = weekday(date) === 5 ? near(bridge.candleLighting, d.sunset, 2) : null;
  out.havdalah = weekday(date) === 6 ? near(bridge.havdalah, d.sunset, 2) : null;
  out.rt = near(bridge.rabbeinuTam, d.sunset, 3);
  return out;
}

// Anywhere else: royzmanim.com's calculator for that place (standard refraction, no terrain).
const royCache = new Map();
const script = (src) => new Promise((resolve, reject) => { const s = document.createElement("script"); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s); });
export function royFor(loc) {
  const key = `${Number(loc.lat).toFixed(4)},${Number(loc.long).toFixed(4)}`;
  if (!royCache.has(key)) {
    royCache.set(key, (async () => {
      const live = await import(/* @vite-ignore */ `${BASE}assets/js/tv/roy-live.js`);
      if (!globalThis.Temporal?.Now?.plainDateISO) await script(ROY + "libraries/temporal-polyfill/global.min.js");
      const [KZ, core, roy] = await Promise.all([
        import(/* @vite-ignore */ ROY + "libraries/kosherZmanim/kosher-zmanim.js"),
        import(/* @vite-ignore */ ROY + "js/core/zmanimCore.js"),
        import(/* @vite-ignore */ ROY + "js/ROYZmanim.js"),
      ]);
      const geo = new KZ.GeoLocation(loc.name, Number(loc.lat), Number(loc.long), Number(loc.elevation) || 0, loc.tz);
      const settings = core.zemanimSettings(core.settingSourceFrom(loc.tz === "Asia/Jerusalem" ? { candles: "40" } : {}));
      const { config } = core.buildZemanimConfig(geo, settings, { atmosphereProvider: null, horizon: null, haze: null });
      const calc = new roy.ZemanFunctions(geo, config);
      const R = live.ROUND;
      return (date) => {
        calc.setDate(globalThis.Temporal.PlainDate.from(date));
        const g = (getter, r) => { try { return live.royMinute(live.epochOf(calc[getter]()), r); } catch { return null; } };
        return {
          alot: g("getAlotHashahar", R.alot), misheyakir: g("getMisheyakir", R.misheyakir), sunrise: g("getNetz", R.sunrise),
          shema: g("getSofZemanShemaGRA", R.shemaGRA), shemaMGA: g("getSofZemanShemaMGA", R.shemaMGA), tefila: g("getSofZemanBerakhothShema", R.tefila),
          hatzot: g("getHatzoth", R.hatzot), minchaGedola: g("getMinhaGedolah", R.minchaGedola), plag: g("getPlagHaminhaHalachaBrurah", R.plag),
          sunset: g("getShkiya", R.sunset), tzet: g("getTzet", R.tzet), midnight: g("getSolarMidnight", R.midnight),
          candles: weekday(date) === 5 ? g("getCandleLighting", R.candleLighting) : null,
          havdalah: weekday(date) === 6 ? g("getTzetMelakha", R.havdalah) : null,
          rt: g("getTzetRT", R.rabbeinuTam),
        };
      };
    })().catch((e) => { royCache.delete(key); throw e; }));
  }
  return royCache.get(key);
}

// ── Every opinion for one day ──

// { opinions: { [zmanId]: [{ id, label, at }] }, hour, mgaHour, fri, havdalah }
export function opinionsFor(K, date, loc, roy) {
  const geo = new K.GeoLocation(loc.name, Number(loc.lat), Number(loc.long), 0, loc.tz);
  const c = new K.ZmanimCalendar(geo);
  c.setDate(K.Temporal.PlainDate.from(date));
  const below = (deg) => ms(c.getSunriseOffsetByDegrees(90 + deg));
  const after = (deg) => ms(c.getSunsetOffsetByDegrees(90 + deg));
  const rise = ms(c.getSeaLevelSunrise());
  const set = ms(c.getSeaLevelSunset());
  const noon = ms(c.getSunTransit());
  const mga = [rise - 72 * MIN, set + 72 * MIN];
  const chabad = [below(1.583), after(1.583)];
  const hour = (set - rise) / 12;
  const fri = weekday(date) === 5;
  const israel = loc.tz === "Asia/Jerusalem";

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
    candles: fri ? (israel
      ? [["18", "40 minutes (Jerusalem)", set - 40 * MIN], ["20", "20 minutes", set - 20 * MIN]]
      : [["18", "18 minutes before sunset", set - 18 * MIN], ["20", "20 minutes", set - 20 * MIN], ["40", "40 minutes", set - 40 * MIN]]) : [],
    sunset: [["sea", "Sea level", set]],
    tzet: [["7.083", "7.083°", after(7.083)], ["8.5", "8.5°", after(8.5)], ["chabad", "Chabad (6°)", after(6)], ["50", "50 minutes", set + 50 * MIN], ["72", "72 minutes", set + 72 * MIN]],
    rt: [["72", "72 minutes", set + 72 * MIN], ["72z", "72 proportional minutes", set + hour * 1.2], ["16.1", "16.1°", after(16.1)]],
    midnight: [["astro", "Astronomical", ms(c.getSolarMidnight())]],
  };
  const royLabel = loc.id === "ucla" ? "Rabbi Ovadia (Hillel TV)" : "Rabbi Ovadia";
  const out = {};
  for (const z of ZMANIM) {
    const ops = (list[z.id] || []).map(([id, label, at]) => ({ id, label, at: round(at, z.later) }));
    if (roy?.[z.id] != null && (!z.friday || fri)) ops.unshift({ id: "roy", label: royLabel, at: roy[z.id] });
    if (z.id === "shema" && roy?.shemaMGA != null) ops.splice(1, 0, { id: "royMGA", label: "Rabbi Ovadia (Magen Avraham)", at: roy.shemaMGA });
    out[z.id] = ops;
  }
  return { opinions: out, hour, mgaHour: (mga[1] - mga[0]) / 12, fri, havdalah: roy?.havdalah ?? null };
}

// The rows to show: each zman with its time in this minhag and its other opinions.
export function rowsFor(K, date, loc, roy, prefs) {
  const { opinions, hour, mgaHour, fri, havdalah } = opinionsFor(K, date, loc, roy);
  const pick = PICK[prefs.minhag] || PICK.sephardi;
  const rows = [];
  for (const z of ZMANIM) {
    if (z.friday && !fri) continue;
    const ops = opinions[z.id];
    const main = ops.find((o) => o.id === pick[z.id]) || ops.find((o) => o.id !== "roy" && o.id !== "royMGA") || ops[0];
    if (!main || main.at == null) continue;
    const others = [];
    for (const o of ops) if (o !== main && o.at != null && !others.some((x) => x.at === o.at && x.label === o.label)) others.push(o);
    rows.push({ ...z, at: main.at, by: main.label, others });
  }
  // Shabbat ends: Rabbi Ovadia's own time when that's the minhag, otherwise nightfall.
  const end = prefs.minhag === "sephardi" && havdalah ? havdalah : rows.find((r) => r.id === "tzet")?.at ?? null;
  return { rows, hour: prefs.minhag === "mga" ? mgaHour : hour, havdalah: end };
}

// ── Calendar ──

const PARSHIYOT = [
  "", "בראשית", "נח", "לך לך", "וירא", "חיי שרה", "תולדות", "ויצא", "וישלח", "וישב", "מקץ", "ויגש", "ויחי",
  "שמות", "וארא", "בא", "בשלח", "יתרו", "משפטים", "תרומה", "תצוה", "כי תשא", "ויקהל", "פקודי",
  "ויקרא", "צו", "שמיני", "תזריע", "מצורע", "אחרי מות", "קדושים", "אמור", "בהר", "בחוקותי",
  "במדבר", "נשא", "בהעלותך", "שלח", "קרח", "חקת", "בלק", "פינחס", "מטות", "מסעי",
  "דברים", "ואתחנן", "עקב", "ראה", "שופטים", "כי תצא", "כי תבוא", "נצבים", "וילך", "האזינו", "וזאת הברכה",
  "ויקהל-פקודי", "תזריע-מצורע", "אחרי מות-קדושים", "בהר-בחוקותי", "קרח-חקת", "חקת-בלק", "מטות-מסעי", "נצבים-וילך",
];
// This week's parasha (read on the coming Shabbat), in or outside Israel. "" on a Yom Tov.
export function parashaFor(K, saturday, israel) {
  try {
    const j = new K.JewishCalendar(K.Temporal.PlainDate.from(saturday));
    j.setInIsrael(israel);
    return PARSHIYOT[j.getParshah()] || "";
  } catch { return ""; }
}

// The coming Shabbat: Friday and Saturday's dates from a given day.
export function shabbatOf(date) {
  const sat = addDays(date, (6 - weekday(date) + 7) % 7);
  return { fri: addDays(sat, -1), sat };
}

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

const noonOf = (date) => new Date(date + "T12:00:00Z");
export function hebrewDate(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("he-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).formatToParts(noonOf(date)).map((p) => [p.type, p.value]));
  const en = new Intl.DateTimeFormat("en-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(noonOf(date));
  return { he: `${gematria(Number(parts.day))} ${parts.month.replace(/^ב/, "")} ${gematria(Number(parts.year))}`, en: en.replace("Heshvan", "Cheshvan") };
}
export const civilDate = (date, opts = { weekday: "long", month: "short", day: "numeric", year: "numeric" }) =>
  new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(noonOf(date));

export const weekFrom = (today) => Array.from({ length: 7 }, (_, i) => addDays(today, i));

// ── Places ──

export async function searchPlaces(q) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=7&language=en&format=json`);
  const j = await r.json();
  return (j.results || []).map((p) => ({
    id: `geo-${p.id}`, name: p.name, sub: [p.admin1, p.country].filter((x) => x && x !== p.name).join(", "),
    lat: p.latitude, long: p.longitude, elevation: Math.max(0, p.elevation || 0), tz: p.timezone,
  }));
}

// The phone's own position. The name comes from a free reverse lookup, if it answers.
export function herePlace() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser can't share its location."));
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const lat = Number(coords.latitude.toFixed(4)), long = Number(coords.longitude.toFixed(4));
      let name = "My location", sub = "";
      try {
        const j = await (await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${long}&localityLanguage=en`)).json();
        name = j.city || j.locality || name;
        sub = [j.principalSubdivision, j.countryName].filter(Boolean).join(", ");
      } catch { /* the coordinates are enough */ }
      resolve({ id: "here", name, sub, lat, long, elevation: 0, tz: deviceTz() });
    }, (e) => reject(new Error(e.code === 1 ? "Location is off for this site. Allow it in your browser settings, or search instead." : "Couldn't find where you are. Try searching.")), { enableHighAccuracy: false, timeout: 12000, maximumAge: 600000 });
  });
}
