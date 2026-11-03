// Works out what a WhatsApp poll is about: which minyan, which day, and what each
// option means (a time, "yes", or "no"). Kept free of WhatsApp and Firebase so it can be tested.

export const TZ = "America/Los_Angeles";
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const NAMES = [
  { re: /shach|shac?ari|morning/i, name: /shach/i },
  { re: /minc?ha|afternoon/i, name: /minc?ha/i },
  { re: /arvit|ma'?ariv|maariv|evening|night/i, name: /arvit|ma'?ariv/i },
];
const NO = /\b(no|nope|not|can'?t|cannot|won'?t|out|maybe|busy)\b|❌|👎/i;

export const dayKey = (ms = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ms));
export function addDays(date, n) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekday = (date) => new Date(date + "T12:00:00Z").getUTCDay();

export const asList = (v) => (Array.isArray(v) ? v.filter(Boolean) : v && typeof v === "object" ? Object.values(v).filter(Boolean) : []);

// "9", "9:00", "9am", "9:30 PM", "21:00" → "HH:MM". Bare hours lean on the known times,
// then on the minyan (an 8 for Mincha means 8 PM is unlikely; morning for Shacharit).
export function timeIn(text, known = [], hint = "") {
  const m = String(text).match(/(?:^|[^\d])(\d{1,2})(?:[:.](\d{2}))?\s*([ap])?\.?\s*m?\.?(?![\d])/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] || "00";
  if (h > 23 || Number(min) > 59 || (!m[2] && !m[3] && h === 0)) return null;
  const ap = m[3]?.toLowerCase();
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  const pad = (x) => `${String(x).padStart(2, "0")}:${min}`;
  if (ap || h > 12) return pad(h);
  const near = known.find((t) => t.endsWith(":" + min) && Number(t.slice(0, 2)) % 12 === h % 12);
  if (near) return near;
  if (/shach/i.test(hint)) return pad(h === 12 ? 0 : h);
  return pad(h < 7 || h === 12 ? (h === 12 ? 12 : h + 12) : h);
}

export function dateOf(question, sentAt) {
  const today = dayKey(sentAt);
  const q = question.toLowerCase();
  if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(q)) return today;
  if (/\b(tomorrow|tmrw|tmr|tomorow)\b/.test(q)) return addDays(today, 1);
  const named = DAYS.findIndex((d) => new RegExp(`\\b${d.slice(0, 3)}(${d.slice(3)})?\\b`).test(q));
  if (named >= 0) return addDays(today, (named - weekday(today) + 7) % 7);
  return addDays(today, 1);
}

const runsOn = (m, date) => (m.date ? m.date === date : asList(m.days).includes(weekday(date)));
export const timesOf = (m, date) => {
  const live = m.live?.date === date ? m.live : null;
  return [...new Set(asList(live?.options).length ? asList(live.options) : asList(m.options).length ? asList(m.options) : [m.time?.type === "fixed" ? m.time.value : ""])].filter(Boolean).sort();
};

// The minyan a poll is about, or null when it isn't about one.
export function minyanFor(question, minyanim, date) {
  const list = asList(minyanim);
  const kind = NAMES.find((k) => k.re.test(question));
  const pick = (pool) => (kind ? pool.find((m) => kind.name.test(m.name || "")) : pool.length === 1 ? pool[0] : null);
  return pick(list.filter((m) => runsOn(m, date))) || (kind ? pick(list) : null);
}

// Each option → { time } for a time, { yes: true }, or { no: true }.
export function readOption(text, known, hint) {
  if (NO.test(text)) return { no: true };
  const time = timeIn(text, known, hint);
  return time ? { time } : { yes: true };
}

// A voter's picks → what to save, or null to take them off the list.
export function choiceOf(picked) {
  const going = picked.filter((p) => !p.no);
  if (!going.length) return null;
  const times = [...new Set(going.filter((p) => p.time).map((p) => p.time))].sort();
  return { times };
}
