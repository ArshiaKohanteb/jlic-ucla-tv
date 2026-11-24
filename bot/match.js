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

// "9", "9:00", "9am", "9:30 PM", "21:00", and typos without the colon ("333 pm", "1030")
// → "HH:MM". Bare hours lean on the known times, then on the minyan (an 8 for Mincha
// means 8 PM is unlikely; morning for Shacharit). A time that can't be right for the
// minyan ("2am" for Mincha) gets its AM/PM flipped if that fits, and is dropped if not.
export function timeIn(text, known = [], hint = "") {
  const m = String(text).match(/(?:^|[^\d])(\d{1,2})(?:[:.]?(\d{2}))?\s*([ap])?\.?\s*m?\.?(?![\d])/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] || "00";
  if (h > 23 || Number(min) > 59 || (!m[2] && !m[3] && h === 0)) return null;
  const ap = m[3]?.toLowerCase();
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  const pad = (x) => `${String(x).padStart(2, "0")}:${min}`;
  let t;
  if (ap || h > 12) t = pad(h);
  else {
    const near = known.find((k) => k.endsWith(":" + min) && Number(k.slice(0, 2)) % 12 === h % 12);
    if (near) return near;
    t = /shach/i.test(hint) ? pad(h === 12 ? 0 : h) : pad(h < 7 || h === 12 ? (h === 12 ? 12 : h + 12) : h);
  }
  if (fits(t, hint)) return t;
  const flipped = pad((Number(t.slice(0, 2)) + 12) % 24);
  return fits(flipped, hint) ? flipped : null;
}

// When each minyan can be, roughly (in minutes after midnight). Unknown names allow any time.
const WINDOWS = [
  { name: /shach/i, from: 4 * 60, to: 13 * 60 },
  { name: /minc?ha/i, from: 11 * 60 + 30, to: 21 * 60 },
  { name: /arvit|ma'?ariv/i, from: 16 * 60, to: 27 * 60 },
];
function fits(t, hint) {
  const w = WINDOWS.find((x) => x.name.test(hint || ""));
  if (!w) return true;
  const mins = Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return (mins >= w.from && mins < w.to) || (mins + 24 * 60 >= w.from && mins + 24 * 60 < w.to);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const nowHHMM = (ms) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));

// A day the question names: today/tonight, tomorrow (and its usual misspellings), a weekday,
// or a date ("11/25", "Nov 25", "November 25th"). null when it names none.
export function namedDate(question, sentAt) {
  const today = dayKey(sentAt);
  const q = question.toLowerCase();
  if (/\b(today|tonight|this (morning|afternoon|evening))\b/.test(q)) return today;
  if (/\b(tmr|to?m+o?r+o?w+(?:'?s)?)\b/.test(q)) return addDays(today, 1);
  const year = Number(today.slice(0, 4));
  const on = (mo, d) => {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    // The coming one: a date more than a couple of months back means next year's.
    let date = `${year}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (date < addDays(today, -60)) date = `${year + 1}${date.slice(4)}`;
    return date;
  };
  const slash = q.match(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/);
  if (slash) { const d = on(Number(slash[1]), Number(slash[2])); if (d) return d; }
  const named = q.match(new RegExp(`\\b(${MONTHS.join("|")})[a-z]*\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (named) { const d = on(MONTHS.indexOf(named[1]) + 1, Number(named[2])); if (d) return d; }
  const day = DAYS.findIndex((d) => new RegExp(`\\b${d.slice(0, 3)}(${d.slice(3)})?\\b`).test(q));
  if (day >= 0) return addDays(today, (day - weekday(today) + 7) % 7);
  return null;
}

// The day a poll is about. With no day in it: today if that minyan is still ahead today
// (by its times or the poll's own), otherwise tomorrow.
export function dateOf(question, sentAt, minyanim = [], options = []) {
  const named = namedDate(question, sentAt);
  if (named) return named;
  const today = dayKey(sentAt);
  const m = minyanFor(question, minyanim, today);
  if (m && runsOn(m, today)) {
    const times = [...timesOf(m, today), ...options.map((o) => readOption(o, timesOf(m, today), m.name).time).filter(Boolean)];
    if (times.some((t) => t > nowHHMM(sentAt))) return today;
  }
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

// A voter's picks → what to save, or null to take them off the list. In a poll of times
// (timed), an option that isn't a readable time doesn't count, so nobody is saved as
// coming with no time.
export function choiceOf(picked, timed = false) {
  const going = picked.filter((p) => !p.no && (!timed || p.time));
  if (!going.length) return null;
  const times = [...new Set(going.filter((p) => p.time).map((p) => p.time))].sort();
  return { times };
}
