// Free lunches by WhatsApp: someone messages the bot "lunch", it uses up one of their free
// lunches and replies with a ticket link to show at OKT (uclaminyan.com/lunch/#…).
//
// Lunches are counted exactly like the TV's leaderboard (the same code, from the site), so
// the number someone sees on the TV is the number the bot goes by.
import { randomBytes } from "node:crypto";
import { buildLog, buildStats, lunchBoard } from "../tv-app/src/shared/tally.js";
import { asList, dayKey } from "./match.js";

export const TICKET_MINUTES = 20;
const LUNCH_URL = process.env.LUNCH_URL || "https://uclaminyan.com/lunch/";

// "lunch", "Free lunch!", "meal pls" — and nothing else, so the bot stays quiet otherwise.
export const asksForLunch = (text) => /^\W*(free\s+)?(lunch|meal)(\s+(please|pls|plz))?\W*$/i.test(String(text || "").trim());

// One person's row from the leaderboard: { key, short, count, earned, used, free, toNext }.
export async function lunchRow(db, key, today = dayKey()) {
  const [minyanim, signups, attendance, lunches] = await Promise.all(
    ["tv/minyanim", "signups", "attendance", "lunches"].map(async (p) => (await db.ref(p).get()).val()),
  );
  const log = buildLog({ minyanim: asList(minyanim) }, signups || {}, attendance || {}, today);
  return lunchBoard(buildStats(log, today).board, lunches || {}).find((r) => r.key === key) || null;
}

// Uses up one lunch and makes a ticket, or says why not. Asking again while a ticket is
// still good sends the same ticket instead of using another lunch.
export async function claimLunch(db, key, now = Date.now()) {
  const open = (await db.ref(`waBot/tickets/${key}`).get()).val();
  if (open?.expires > now) return { ticket: open.ticket, again: true, left: open.left };

  const row = await lunchRow(db, key, dayKey(now));
  if (!row || row.free <= 0) return { row };

  let took = false;
  await db.ref(`lunches/${key}`).transaction((cur) => {
    const used = Math.max(0, Number(cur?.used) || 0);
    if (used >= row.earned) { took = false; return undefined; }
    took = true;
    return { used: used + 1, name: row.short };
  });
  if (!took) return { row: { ...row, free: 0 } };

  const ticket = randomBytes(16).toString("base64url");
  const left = row.free - 1;
  const expires = now + TICKET_MINUTES * 60_000;
  await db.ref(`meals/${ticket}`).set({ short: row.short, at: now, expires, left });
  await db.ref(`waBot/tickets/${key}`).set({ ticket, expires, left });
  return { ticket, left, row };
}

export function lunchReply(result) {
  if (result.ticket) {
    const link = `${LUNCH_URL}#${result.ticket}`;
    const more = result.left > 0 ? `\nYou have ${result.left} more after this one.` : "";
    return result.again
      ? `Here's your free lunch ticket again 🍽️\n${link}`
      : `Free lunch 🍽️ Show this at OKT:\n${link}\nIt's good for the next ${TICKET_MINUTES} minutes.${more}`;
  }
  const r = result.row;
  if (!r) return "I don't see any minyanim from this number yet. Every 3 minyanim you vote for in the group earn a free lunch at OKT.";
  const n = r.toNext === 1 ? "1 more minyan" : `${r.toNext} more minyanim`;
  return `No free lunch right now. ${n} to your next one (you've been to ${r.count}).`;
}
