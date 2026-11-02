// ═══════════════════════════════════════════════════════════════
// roy-live.js — the zmanim exactly as royzmanim.com shows them
//
// Loads Rabbi Ovadia Yosef Zmanim's own calculator straight from
// royzmanim.com (its headless core, the same code the calendar page and
// notification server run), with the same weather-based refraction, so
// every time and every rounding matches the site. Visible sunrise (the
// "eye" netz) needs terrain ray tracing that takes seconds per day, so it
// runs in a background worker and is cached per day.
// If the site can't be reached, the bridge falls back to the local engine.
// ═══════════════════════════════════════════════════════════════

const ROY = "https://royzmanim.com/assets/";
const REFRESH_MS = 3 * 60 * 60 * 1000; // the site refreshes its forecast every 3 hours
const NETZ_KEY = "tv-visible-netz-v1";

// How royzmanim.com writes each zman to the minute (_data/zmanim.yml):
// past :40 always moves to the next minute; past :20 too when rounding "later".
export const ROUND = {
  alot: "earlier", misheyakir: "later", sunrise: "later", shemaMGA: "earlier", shemaGRA: "earlier",
  tefila: "earlier", hatzot: "earlier", minchaGedola: "later", plag: "later", sunset: "earlier",
  tzet: "later", midnight: "later", candleLighting: "earlier", havdalah: "later", rabbeinuTam: "earlier",
};

/** The minute royzmanim.com shows for a time (epoch ms in, epoch ms of that minute out). */
export function royMinute(ms, round) {
  if (ms == null || !Number.isFinite(ms)) return null;
  const minute = Math.floor(ms / 60000) * 60000;
  const sec = Math.floor((ms - minute) / 1000); // whole seconds, as the site compares them
  return sec > 40 || (sec > 20 && round === "later") ? minute + 60000 : minute;
}

/** Epoch ms from a ZonedDateTime or ROY's { time } wrapper. */
export function epochOf(v) {
  if (!v) return null;
  if (typeof v.epochMilliseconds === "number") return v.epochMilliseconds;
  if (v.time && typeof v.time.epochMilliseconds === "number") return v.time.epochMilliseconds;
  return null;
}

async function ensureTemporal() {
  if (globalThis.Temporal?.Now?.plainDateISO) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = ROY + "libraries/temporal-polyfill/global.min.js";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ROY's settings: only pass what differs from the site's defaults (20 min candles, 30 min / 7.165° tzet).
function settingValues(loc) {
  const v = {};
  if (loc.candleLighting && Number(loc.candleLighting) !== 20) v.candles = String(loc.candleLighting);
  if (loc.tzeitMinutes && Number(loc.tzeitMinutes) !== 30) v.tzeithIMmin = String(loc.tzeitMinutes);
  return v;
}

let live = null;
let loadedAt = 0;

/**
 * ROY's calculator for this place, or a rejected promise if the site can't be reached.
 * @returns {Promise<{ at: (isoDate: string) => any }>}
 */
export function loadRoy(loc) {
  if (live && Date.now() - loadedAt < REFRESH_MS) return live;
  loadedAt = Date.now();
  const previous = live;
  live = (async () => {
    await ensureTemporal();
    const [KZ, core, roy] = await Promise.all([
      import(ROY + "libraries/kosherZmanim/kosher-zmanim.js"),
      import(ROY + "js/core/zmanimCore.js"),
      import(ROY + "js/ROYZmanim.js"),
    ]);
    const geo = new KZ.GeoLocation(loc.name || "Shul", Number(loc.lat), Number(loc.long), Number(loc.elevation) || 0, loc.timezone);
    // Weather-based refraction and haze, as the site uses. The terrain horizon (visible sunrise) is left
    // to the worker so nothing here blocks the screen.
    let refraction = { atmosphereProvider: null, horizon: null, haze: null };
    try {
      const rd = await import(ROY + "js/refraction-data.js");
      const data = await rd.loadRefraction(geo.getLatitude(), geo.getLongitude(), {});
      refraction = { atmosphereProvider: data.provider, horizon: null, haze: data.haze ?? null };
    } catch (e) {
      console.warn("[roy-live] refraction unavailable, using standard refraction", e);
    }
    const settings = core.zemanimSettings(core.settingSourceFrom(settingValues(loc)));
    const { config } = core.buildZemanimConfig(geo, settings, refraction);
    const calc = new roy.ZemanFunctions(geo, config);
    return {
      at(isoDate) {
        calc.setDate(Temporal.PlainDate.from(isoDate));
        return calc;
      },
    };
  })();
  // Keep using the last good calculator if a refresh fails.
  if (previous) live = live.catch(() => previous);
  else live.catch(() => { live = null; });
  return live;
}

// ── Visible sunrise ──────────────────────────────────────────────

const WORKER_SOURCE = `
const ROY = ${JSON.stringify(ROY)};
self.onmessage = async ({ data }) => {
  const { loc, dates, values } = data;
  try {
    if (!globalThis.Temporal) (0, eval)(await (await fetch(ROY + "libraries/temporal-polyfill/global.min.js")).text());
    const [KZ, core, roy, rd] = await Promise.all([
      import(ROY + "libraries/kosherZmanim/kosher-zmanim.js"),
      import(ROY + "js/core/zmanimCore.js"),
      import(ROY + "js/ROYZmanim.js"),
      import(ROY + "js/refraction-data.js"),
    ]);
    const geo = new KZ.GeoLocation(loc.name || "Shul", +loc.lat, +loc.long, +loc.elevation || 0, loc.timezone);
    const r = await rd.loadRefraction(geo.getLatitude(), geo.getLongitude(), {});
    if (!r.horizon) { self.postMessage({ done: true, note: "no horizon" }); return; }
    const settings = core.zemanimSettings(core.settingSourceFrom(values));
    const { config } = core.buildZemanimConfig(geo, settings, { atmosphereProvider: r.provider, horizon: r.horizon, haze: r.haze ?? null });
    const calc = new roy.ZemanFunctions(geo, config);
    for (const date of dates) {
      calc.setDate(Temporal.PlainDate.from(date));
      const n = calc.getNetz();
      self.postMessage({ date, epoch: n && n.time ? n.time.epochMilliseconds : null });
    }
    self.postMessage({ done: true });
  } catch (e) {
    self.postMessage({ error: String(e && e.message || e) });
  }
};`;

function readNetzCache(placeKey) {
  try {
    const c = JSON.parse(localStorage.getItem(NETZ_KEY) || "null");
    return c && c.place === placeKey ? c.dates || {} : {};
  } catch { return {}; }
}
function writeNetzCache(placeKey, dates) {
  try {
    // Keep only the last couple of weeks
    const cutoff = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const kept = Object.fromEntries(Object.entries(dates).filter(([d]) => d >= cutoff));
    localStorage.setItem(NETZ_KEY, JSON.stringify({ place: placeKey, dates: kept }));
  } catch { /* storage full or blocked */ }
}

let netzBusy = false;

/**
 * Visible sunrise (epoch ms, unrounded) for the given dates: cached ones now, the rest computed in a
 * worker and passed to onResult(date, epoch) as each finishes.
 */
export function visibleNetz(loc, dates, onResult) {
  const placeKey = `${Number(loc.lat).toFixed(6)},${Number(loc.long).toFixed(6)}`;
  const cache = readNetzCache(placeKey);
  const known = {};
  const missing = [];
  for (const d of dates) (d in cache ? (known[d] = cache[d]) : missing.push(d));
  if (!missing.length || netzBusy || typeof Worker === "undefined") return known;

  netzBusy = true;
  let worker;
  try {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    worker = new Worker(url, { type: "module" });
  } catch (e) {
    console.warn("[roy-live] no worker for visible sunrise", e);
    netzBusy = false;
    return known;
  }
  const finish = () => { netzBusy = false; worker.terminate(); };
  worker.onmessage = ({ data }) => {
    if (data.error) { console.warn("[roy-live] visible sunrise", data.error); return finish(); }
    if (data.done) return finish();
    const all = readNetzCache(placeKey);
    all[data.date] = data.epoch;
    writeNetzCache(placeKey, all);
    if (data.epoch) onResult(data.date, data.epoch);
  };
  worker.onerror = (e) => { console.warn("[roy-live] visible sunrise worker", e.message); finish(); };
  worker.postMessage({ loc: { name: loc.name, lat: loc.lat, long: loc.long, elevation: loc.elevation, timezone: loc.timezone }, dates: missing, values: settingValues(loc) });
  return known;
}
