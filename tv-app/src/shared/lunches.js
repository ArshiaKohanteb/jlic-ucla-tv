// Free lunches: every 3 minyanim someone comes to earns one. The count of minyanim
// comes from the attendance log (shared/attendance.js), so it never resets. Lunches
// handed out are kept at /lunches/{personKey} = { used, name }. The TV reads them
// without an account, so they hold only the short display name.
import { onValue, ref, set } from "firebase/database";
import { db } from "./firebase.js";
import { isDemo } from "./store.js";


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

export { PER_LUNCH, shortName, lunchBoard, leaders, lunchesWaiting } from "./tally.js";
