// The record of who came. Nobody takes attendance, so sign-ups stand in for it:
// a past minyan is built from who signed up, and anything an admin changes is
// stored as a correction at /attendance/{date}/{minyanId}, so the original
// sign-ups are never rewritten.
import { onValue, ref, set, remove } from "firebase/database";
import { db } from "./firebase.js";
import { isDemo } from "./store.js";

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

export { buildLog, buildStats } from "./tally.js";
