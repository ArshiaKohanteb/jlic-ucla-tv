// Free lunches: every 3 minyanim someone comes to earns one. The count of minyanim
// comes from the attendance log (shared/attendance.js), so it never resets. Lunches
// handed out are kept at /lunches/{personKey} = { used, name }. The TV reads them
// without an account, so they hold only the short display name.
import { onValue, ref, set } from "firebase/database";
import { db } from "./firebase.js";
import { isDemo } from "./store.js";

export const PER_LUNCH = 3;

const DEMO_KEY = "jlic-lunches-demo";
const DEMO_EVENT = "jlic-lunches-change";
const readDemo = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "{}"); } catch { return {}; } };

export function subscribeLunches(cb) {
  if (isDemo()) {
    const emit = () => cb(readDemo());
    emit();
    window.addEventListener(DEMO_EVENT, emit);
    return () => window.removeEventListener(DEMO_EVENT, emit);
  }
  return onValue(ref(db, "lunches"), (s) => cb(s.val() || {}), () => cb({}));
}

export function setLunchesUsed(key, name, used) {
  const value = used > 0 ? { used, name: String(name || "").slice(0, 40) } : null;
  if (isDemo()) {
    const all = readDemo();
    if (value) all[key] = value; else delete all[key];
    localStorage.setItem(DEMO_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event(DEMO_EVENT));
    return Promise.resolve();
  }
  return set(ref(db, `lunches/${key}`), value);
}

// "Etai Turgeman" → "Etai T.", "David ben Moshe Cohen" → "David C.". Emoji and
// other decorations in WhatsApp names are dropped.
export function shortName(name) {
  const words = String(name || "").replace(/[^\p{L}\p{M}\s'.-]/gu, " ").split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (!words.length) return String(name || "").trim() || "Guest";
  if (words.length === 1) return words[0];
  const last = words[words.length - 1];
  return /^\p{L}\.$/u.test(last) ? `${words[0]} ${last}` : `${words[0]} ${last[0].toUpperCase()}.`;
}

// stats.board (from buildStats) + /lunches → one row per person.
export function lunchBoard(board, lunches) {
  return (board || []).map((p) => {
    const earned = Math.floor(p.count / PER_LUNCH);
    const used = Math.min(earned, Math.max(0, Number(lunches?.[p.key]?.used) || 0));
    return { key: p.key, name: p.name, short: shortName(p.name), count: p.count, earned, used, free: earned - used, toNext: PER_LUNCH - (p.count % PER_LUNCH) };
  });
}

// Most minyanim first; ties go alphabetically.
export const leaders = (rows) => [...rows].sort((a, b) => b.count - a.count || a.short.localeCompare(b.short));

// Everyone with a lunch to claim, A to Z.
export const lunchesWaiting = (rows) => rows.filter((r) => r.free > 0).sort((a, b) => a.short.localeCompare(b.short));
