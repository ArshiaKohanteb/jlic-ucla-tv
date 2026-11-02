// Sign-ups live at /signups/{date}/{minyanId}/{uid}. The TV reads them without an
// account, so each one holds only a short display name, never an email.
import { onValue, query, ref, orderByKey, startAt, remove, set, update } from "firebase/database";
import { db } from "./firebase.js";
import { isDemo } from "./store.js";

const DEMO_KEY = "jlic-signups-demo";
const DEMO_EVENT = "jlic-signups-change";

const readDemo = () => { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || "{}"); } catch { return {}; } };
function writeDemo(fn) {
  const all = readDemo();
  fn(all);
  localStorage.setItem(DEMO_KEY, JSON.stringify(all));
  window.dispatchEvent(new Event(DEMO_EVENT));
}

// cb({ [date]: { [minyanId]: { [uid]: signup } } }) from today onward.
export function subscribeSignups(today, cb, onError) {
  if (isDemo()) {
    const emit = () => cb(readDemo());
    emit();
    window.addEventListener(DEMO_EVENT, emit);
    return () => window.removeEventListener(DEMO_EVENT, emit);
  }
  return onValue(query(ref(db, "signups"), orderByKey(), startAt(today)), (s) => cb(s.val() || {}), onError);
}

// Every sign-up ever, for the dashboard's log and stats.
export function subscribeAllSignups(cb) {
  if (isDemo()) {
    const emit = () => cb(readDemo());
    emit();
    window.addEventListener(DEMO_EVENT, emit);
    return () => window.removeEventListener(DEMO_EVENT, emit);
  }
  return onValue(ref(db, "signups"), (s) => cb(s.val() || {}), () => cb({}));
}

export function saveSignup(date, minyanId, uid, value) {
  if (isDemo()) return Promise.resolve(writeDemo((a) => { ((a[date] ||= {})[minyanId] ||= {})[uid] = value; }));
  return set(ref(db, `signups/${date}/${minyanId}/${uid}`), value);
}

export function patchSignup(date, minyanId, uid, value) {
  if (isDemo()) return Promise.resolve(writeDemo((a) => { Object.assign(a[date][minyanId][uid], value); }));
  return update(ref(db, `signups/${date}/${minyanId}/${uid}`), value);
}

export function removeSignup(date, minyanId, uid) {
  if (isDemo()) return Promise.resolve(writeDemo((a) => { if (a[date]?.[minyanId]) delete a[date][minyanId][uid]; }));
  return remove(ref(db, `signups/${date}/${minyanId}/${uid}`));
}

export const signupList = (signups, date, id) =>
  Object.entries(signups?.[date]?.[id] || {}).map(([uid, v]) => ({ uid, ...v })).sort((a, b) => (a.at || 0) - (b.at || 0));
