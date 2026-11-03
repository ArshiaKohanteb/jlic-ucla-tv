// Reads a WhatsApp poll from screenshots of its "View votes" screen, in the browser.
// The result is only a draft: the admin checks the names before they're added.

const DAYS = "today|yesterday|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?";
const STAMP = new RegExp(`[\\s,.·•-]*((${DAYS})\\b[\\s,]*(at\\s*)?)?(\\d{1,2}[/.]\\d{1,2}([/.]\\d{2,4})?[\\s,]*)?\\d{1,2}[:.]\\d{2}\\s*([ap]\\.?m\\.?)?\\s*$`, "i");
const ONLY_STAMP = new RegExp(`^((${DAYS})\\b[\\s,]*(at\\s*)?)?(\\d{1,2}[/.]\\d{1,2}([/.]\\d{2,4})?[\\s,]*)?(\\d{1,2}[:.]\\d{2}\\s*([ap]\\.?m\\.?)?)?$`, "i");
const VOTES = /[\s★☆*✩✭·•|]*\b(\d+)\s*v[o0]tes?\s*$/i;
const JUNK = /^(poll details|view votes|votes|see all|show all|\d+ more|cancel|done|<|back|search|options?|vote)$/i;
const NO = /\b(no|nope|not|can'?t|cannot|won'?t|out|maybe|busy)\b/i;
const PHONE = /^\+?[\d\s()\-.]{7,}$/;

// "9", "9:00", "9am", "9:00 AM" → the poll time it means, if any.
export function timeIn(text, times) {
  const m = String(text).match(/(?:^|[^\d])(\d{1,2})(?:[:.](\d{2}))?\s*([ap])?\.?\s*m?\.?(?!\d)/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] || "00";
  if (h > 23 || Number(min) > 59) return null;
  const ap = m[3]?.toLowerCase();
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  const exact = `${String(h).padStart(2, "0")}:${min}`;
  if (times.includes(exact)) return exact;
  if (!ap) return times.find((t) => t.endsWith(":" + min) && Number(t.slice(0, 2)) % 12 === h % 12) || null;
  return null;
}

// Avatar initials come out as short junk in front of the name ("(oL]", "£6", "DL"), so
// short leading bits are dropped unless they look like a real first name ("Eli", "Al").
export function cleanName(line) {
  const words = line.replace(STAMP, "").replace(/\s{2,}/g, " ").trim().split(" ");
  const junk = (w) => (w.length <= 3 && !/^\p{Lu}\p{Ll}+$/u.test(w)) || (w.length <= 5 && /[^\p{L}~'-]/u.test(w));
  while (words.length > 1 && junk(words[0])) words.shift();
  return words.join(" ").replace(/^[^\p{L}\d+]+/u, "").replace(/[^\p{L}\p{M}\d)]+$/u, "").trim();
}

export const nameKey = (name) => name.toLowerCase().normalize("NFKD").replace(/[^\p{L}\d]+/gu, " ").trim();

// lines → { groups: [{ label, time, no, names[] }], phones, you }
export function parsePoll(lines, times) {
  const groups = [];
  let phones = 0;
  let you = false;
  let cur = null;
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line || JUNK.test(line)) continue;
    const votes = line.match(VOTES);
    const headerTime = !votes && line.length <= 12 && /^\W*\d/.test(line) ? timeIn(line, times) : null;
    if (votes || headerTime) {
      const text = votes ? line.replace(VOTES, "").replace(/[\s★☆*%•·#]+$/, "").trim() : line;
      const time = timeIn(text, times);
      const key = (time || text).toLowerCase();
      cur = groups.find((g) => g.key === key);
      if (!cur) groups.push((cur = { key, label: text || "Votes", time, no: !time && NO.test(text), names: [] }));
      continue;
    }
    if (!cur || ONLY_STAMP.test(line)) continue;
    if (PHONE.test(line.replace(STAMP, "").replace(/^[^\d+]+/, ""))) { phones++; continue; }
    const name = cleanName(line);
    if (name.length < 2 || !/\p{L}/u.test(name)) continue;
    if (/^you$/i.test(name)) { you = true; continue; }
    if (!cur.names.some((n) => nameKey(n) === nameKey(name))) cur.names.push(name);
  }
  return { groups: groups.map(({ key, ...g }) => g), phones, you };
}

// Light text on a dark screen reads badly, so dark screenshots are flipped first.
function prepare(bitmap) {
  const scale = bitmap.width < 900 ? 2 : 1;
  const c = document.createElement("canvas");
  c.width = bitmap.width * scale;
  c.height = bitmap.height * scale;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bitmap, 0, 0, c.width, c.height);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
  for (let i = 0; i < d.length; i += 40) sum += d[i];
  if (sum / (d.length / 40) < 110) for (let i = 0; i < d.length; i += 4) d[i] = d[i + 1] = d[i + 2] = 255 - d[i];
  g.putImageData(img, 0, 0);
  return c;
}

// bitmaps (top of the list first) → the text lines on them.
export async function readScreens(bitmaps, onProgress) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const lines = [];
    for (let i = 0; i < bitmaps.length; i++) {
      const { data } = await worker.recognize(prepare(bitmaps[i]));
      lines.push(...data.text.split("\n"));
      onProgress?.((i + 1) / bitmaps.length);
    }
    return lines;
  } finally {
    await worker.terminate();
  }
}
