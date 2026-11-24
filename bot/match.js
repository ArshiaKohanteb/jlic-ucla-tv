// Works out what a WhatsApp poll is about: which prayer, which day, and what each option
// means (a time, "yes", or "no"). Kept free of WhatsApp and Firebase so it can be tested.
//
// The group calls prayers many things ("Prayer of the dawn", "Meal offering", שחרית,
// "Mincha/Kabbalat Shabbat"), so everything is sorted into four kinds, shown on the site as
// Shacharit, Mincha, Mincha/Arvit and Arvit.

export const TZ = "America/Los_Angeles";
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const NO = /\b(no|nope|nah|not|can'?t|cannot|won'?t|out|maybe|busy|sorry|pass)\b|❌|👎/i;

// ── The four prayers ──

export const KINDS = {
  shacharit: { name: "Shacharit", from: 4 * 60, to: 13 * 60 },
  mincha: { name: "Mincha", from: 11 * 60 + 30, to: 21 * 60 },
  "mincha-arvit": { name: "Mincha/Arvit", from: 12 * 60, to: 23 * 60 },
  arvit: { name: "Arvit", from: 16 * 60, to: 27 * 60 },
};
const SHACHARIT = /shach|shac?ari|\bmorning\b|\bdawn\b|vatikin|hoshana|שחרית|ותיקין/i;
// "Meal offering" / "Grain offering" is the literal meaning of Mincha.
const MINCHA = /minc?ha|\bafternoon\b|(meal|grain|flour|cereal) offering|מנחה/i;
const ARVIT = /arvit|ma'?ariv|\bevening\b|\bnight\b|ערבית|מעריב/i;
const KABBALAT_SHABBAT = /kabb?all?[ae]t shabb?[ao][st]|kab ?shab|קבלת שבת/i;

// The kind a question, option or minyan name is about, or null. "Mincha/Maariv" and
// Kabbalat Shabbat are one service (Mincha/Arvit); "Mincha and/or maariv" offers both,
// and its plain times are for Mincha.
export function kindOf(text = "") {
  const m = MINCHA.test(text), a = ARVIT.test(text), k = KABBALAT_SHABBAT.test(text);
  if (m && (a || k)) return /and\/or|\bor\b/i.test(text) ? "mincha" : "mincha-arvit";
  if (k) return "mincha-arvit";
  if (m) return "mincha";
  if (a) return "arvit";
  if (SHACHARIT.test(text)) return "shacharit";
  return null;
}
export const kindName = (kind) => KINDS[kind]?.name || "";

export const dayKey = (ms = Date.now()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(ms));
export function addDays(date, n) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const weekday = (date) => new Date(date + "T12:00:00Z").getUTCDay();

export const asList = (v) => (Array.isArray(v) ? v.filter(Boolean) : v && typeof v === "object" ? Object.values(v).filter(Boolean) : []);

// ── Times ──

// "9", "9:00", "9am", "9:30 PM", "21:00", and typos without the colon ("333 pm", "1030")
// → "HH:MM". Bare hours lean on the known times, then on the prayer (an 8 for Mincha
// means 8 PM is unlikely; morning for Shacharit). A time that can't be right for the
// prayer ("2am" for Mincha) gets its AM/PM flipped if that fits, and is dropped if not.
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
    t = kindOf(hint) === "shacharit" ? pad(h === 12 ? 0 : h) : pad(h < 7 || h === 12 ? (h === 12 ? 12 : h + 12) : h);
  }
  if (fits(t, hint)) return t;
  const flipped = pad((Number(t.slice(0, 2)) + 12) % 24);
  return fits(flipped, hint) ? flipped : null;
}

// Whether a time can be right for that prayer. Unknown names allow any time.
function fits(t, hint) {
  const w = KINDS[kindOf(hint || "")];
  if (!w) return true;
  const mins = Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  return (mins >= w.from && mins < w.to) || (mins + 24 * 60 >= w.from && mins + 24 * 60 < w.to);
}

// ── Days ──

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const HEBREW_DAYS = "אבגדהו"; // א׳ בשבת is Sunday … ו׳ בשבת is Friday
const nowHHMM = (ms) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));

// A day the question names: today/tonight, tomorrow (and its usual misspellings), a weekday
// in English or Hebrew ("ב׳ בשבת"), or a date ("11/25", "Nov 25"). null when it names none.
export function namedDate(question, sentAt) {
  const today = dayKey(sentAt);
  const q = question.toLowerCase();
  const onWeekday = (day) => addDays(today, (day - weekday(today) + 7) % 7);
  if (/\b(today|tonight|tonite|tnt|this (morning|afternoon|evening))\b/.test(q)) return today;
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
  if (day >= 0) return onWeekday(day);
  const heb = question.match(/(?:^|[\s,(])([אבגדהו])['׳]?\s*ב?שבת/);
  if (heb) return onWeekday(HEBREW_DAYS.indexOf(heb[1]));
  return null;
}

// ── Minyanim ──

export const runsOn = (m, date) => (m.date ? m.date === date : asList(m.days).includes(weekday(date)));
export const timesOf = (m, date) => {
  const live = m.live?.date === date ? m.live : null;
  return [...new Set(asList(live?.options).length ? asList(live.options) : asList(m.options).length ? asList(m.options) : [m.time?.type === "fixed" ? m.time.value : ""])].filter(Boolean).sort();
};

// The site's minyan for a kind of prayer (one that runs that day first), or null.
export function minyanOf(kind, minyanim, date) {
  const pool = asList(minyanim).filter((m) => kindOf(m.name) === kind);
  return pool.find((m) => runsOn(m, date)) || pool[0] || null;
}

// The minyan a question is about, or null. With no prayer named, the only minyan that day.
export function minyanFor(question, minyanim, date) {
  const kind = kindOf(question);
  if (kind) return minyanOf(kind, minyanim, date);
  const today = asList(minyanim).filter((m) => runsOn(m, date));
  return today.length === 1 ? today[0] : null;
}

// Each option → { time } for a time, { yes: true }, or { no: true }.
export function readOption(text, known, hint) {
  if (NO.test(text)) return { no: true };
  const time = timeIn(text, known, hint);
  return time ? { time } : { yes: true };
}

// ── A whole poll ──

// Everything the bot needs from a poll, or null when it isn't a minyan poll (no prayer, or
// no time anywhere: "Who should make the mincha poll?"). Each option gets its own kind, so
// "6:25 mincha/maariv" in a Mincha poll counts for Mincha/Arvit. A yes/no poll with a time in
// the question ("Mincha 2:30") counts its yes votes for that time.
export function readPoll(question, options, minyanim, sentAt, { anyway = false } = {}) {
  const bare = options.map((o) => timeIn(o)).filter(Boolean);
  let kind = kindOf(question);
  if (!kind) {
    // No prayer named ("Optimal Tuesday minyan"): the one prayer all its times fit.
    const fitting = bare.length ? Object.keys(KINDS).filter((k) => bare.every((t) => fits(t, kindName(k)))) : [];
    kind = fitting.length === 1 ? fitting[0] : null;
  }
  if (!kind) {
    const only = minyanFor(question, minyanim, dayKey(sentAt));
    kind = only ? kindOf(only.name) : null;
  }
  if (!kind) return null;

  const readAll = (date) => {
    const known = (k) => { const m = minyanOf(k, minyanim, date); return m ? timesOf(m, date) : []; };
    const read = options.map((text) => {
      let k = kindOf(text) || kind;
      // "4:45 with maariv" in a Mincha poll is Mincha with Maariv right after.
      if (k === "arvit" && kind === "mincha" && /\bwith\b/i.test(text)) k = "mincha-arvit";
      return { text, kind: k, ...readOption(text, known(k), kindName(k)) };
    });
    const asked = read.some((o) => o.time) ? null : timeIn(question, known(kind), kindName(kind));
    if (asked) read.forEach((o) => { if (o.yes) { delete o.yes; o.time = asked; } });
    return read;
  };

  let date = namedDate(question, sentAt);
  if (!date) {
    // No day named: today if this prayer is still ahead today (by the poll's times or the
    // minyan's own), otherwise tomorrow.
    const today = dayKey(sentAt);
    const m = minyanOf(kind, minyanim, today);
    const times = [...readAll(today).map((o) => o.time), ...(m && runsOn(m, today) ? timesOf(m, today) : [])].filter(Boolean);
    date = times.some((t) => t > nowHHMM(sentAt)) ? today : addDays(today, 1);
  }
  const read = readAll(date);
  if (!anyway && !read.some((o) => o.time)) return null;
  return { kind, date, options: read };
}

// The day a poll is about (see readPoll).
export function dateOf(question, sentAt, minyanim = [], options = []) {
  return readPoll(question, options, minyanim, sentAt, { anyway: true })?.date || namedDate(question, sentAt) || addDays(dayKey(sentAt), 1);
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
