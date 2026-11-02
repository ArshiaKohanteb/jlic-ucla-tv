// Read/write the /tv data. Normally that's Firebase; with ?demo in the URL
// everything stays in this browser's localStorage so the dashboard can be
// tried out without signing in or touching the real TV.
import { onValue, set, update } from "firebase/database";
import { tvRef } from "./firebase.js";
import { DEFAULT_TV, normalizeTv } from "./defaults.js";

export const isDemo = () => new URLSearchParams(location.search).has("demo");

const CACHE_KEY = "jlic-tv-cache-v2";
const DEMO_KEY = "jlic-tv-demo-v2";
const DEMO_EVENT = "jlic-tv-demo-change";

function readLocal(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function writeLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

export function readCache() {
  return readLocal(CACHE_KEY);
}

// Who is editing (set by the dashboard) and the last data it saw, so each
// save can stamp the items it changed with a name and time.
let editor = "";
let lastSeen = null;
export const setEditor = (name) => { editor = name || ""; };

const STAMP = ["editedBy", "editedAt", "order"];
function sameItem(a, b) {
  const strip = (o) => JSON.stringify(o, (k, v) => (STAMP.includes(k) ? undefined : v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));
  return strip(a) === strip(b);
}
function stamp(path, value) {
  const prev = lastSeen?.[path];
  if (!editor || !Array.isArray(value) || !Array.isArray(prev)) return value;
  const byId = new Map(prev.map((x) => [x.id, x]));
  const at = Date.now();
  return value.map((item) => {
    const old = byId.get(item?.id);
    if (!item?.id) return item;
    if (old && sameItem(old, item)) return old.editedBy ? { ...item, editedBy: old.editedBy, editedAt: old.editedAt } : item;
    return { ...item, editedBy: editor, editedAt: at };
  });
}
function logEdit(path) {
  if (!editor) return;
  const key = path.split("/")[0];
  writeRaw(`edits/${key}`, { by: editor, at: Date.now() }).catch(() => {});
}

// cb(tvData, { fromServer, empty })
export function subscribeTv(listener) {
  const cb = (data, meta) => { lastSeen = data; listener(data, meta); };
  if (isDemo()) {
    const emit = () => cb(normalizeTv(readLocal(DEMO_KEY) || DEFAULT_TV), { fromServer: true, empty: false });
    emit();
    const onStorage = (e) => { if (!e.key || e.key === DEMO_KEY) emit(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(DEMO_EVENT, emit);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(DEMO_EVENT, emit); };
  }
  const cached = readCache();
  if (cached) cb(normalizeTv(cached), { fromServer: false, empty: false });
  return onValue(tvRef(), (snap) => {
    const raw = snap.val();
    if (raw) writeLocal(CACHE_KEY, raw);
    cb(normalizeTv(raw), { fromServer: true, empty: !raw });
  }, (err) => console.warn("[tv] firebase read failed", err));
}

function setIn(obj, path, value) {
  const keys = path.split("/");
  const root = { ...(obj || {}) };
  let cur = root;
  keys.slice(0, -1).forEach((k) => { cur[k] = { ...(cur[k] || {}) }; cur = cur[k]; });
  cur[keys[keys.length - 1]] = value;
  return root;
}

export async function writeTv(path, value) {
  const out = await writeRaw(path, stamp(path, value));
  logEdit(path);
  return out;
}

async function writeRaw(path, value) {
  if (isDemo()) {
    const current = readLocal(DEMO_KEY) || DEFAULT_TV;
    writeLocal(DEMO_KEY, setIn(current, path, value));
    window.dispatchEvent(new Event(DEMO_EVENT));
    return;
  }
  return set(tvRef(path), value);
}

export async function patchTv(path, partial) {
  if (isDemo()) {
    const current = readLocal(DEMO_KEY) || DEFAULT_TV;
    const base = path.split("/").reduce((o, k) => (o ? o[k] : undefined), current) || {};
    await writeRaw(path, { ...base, ...partial });
  } else {
    await update(tvRef(path), partial);
  }
  logEdit(path);
}

export async function seedTv() {
  if (isDemo()) return writeTv("settings", DEFAULT_TV.settings);
  return set(tvRef(), DEFAULT_TV);
}
