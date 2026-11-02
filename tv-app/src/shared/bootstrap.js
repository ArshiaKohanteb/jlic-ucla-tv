// Start the zmanim engine. Location and calculation settings live in the
// dashboard; the last copy saved on this device is written into the page's
// config before the engine reads it. (Changing them restarts every screen.)
import { readCache, isDemo } from "./store.js";

export function startZmanimEngine() {
  try {
    const tag = document.getElementById("zy-scheduleScreen-config");
    const cached = isDemo() ? JSON.parse(localStorage.getItem("jlic-tv-demo-v2") || "null") : readCache();
    const loc = cached?.settings?.location;
    if (tag && loc && loc.lat && loc.long) {
      const cfg = JSON.parse(tag.textContent);
      cfg.location = {
        name: loc.name || cfg.location.name,
        lat: Number(loc.lat),
        long: Number(loc.long),
        elevation: Number(loc.elevation) || 0,
        timezone: loc.timezone || cfg.location.timezone,
      };
      cfg.customTimes.candleLighting = Number(loc.candleLighting ?? cfg.customTimes.candleLighting);
      cfg.customTimes.tzeithIssurMelakha.minutes = Number(loc.tzeitMinutes ?? cfg.customTimes.tzeithIssurMelakha.minutes);
      tag.textContent = JSON.stringify(cfg);
    }
  } catch (e) {
    console.warn("[tv] using default location", e);
  }
  const s = document.createElement("script");
  s.type = "module";
  s.src = `${import.meta.env.BASE_URL}assets/js/tv/zmanim-bridge.js`;
  document.head.appendChild(s);
}
