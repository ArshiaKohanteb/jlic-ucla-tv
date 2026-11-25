// Safeguards from what other WhatsApp-library users found (GitHub, 2026): WhatsApp removes a
// linked device when it "reaches out" from a newer account, that is, sends in a private chat
// without the other person's privacy token (tctoken). The phone and the number are fine; only
// the linked device goes, and it has to be scanned in again.
//
// So before the bot replies to anyone, it checks two things and stays quiet if either fails:
//  1. WhatsApp hasn't put the account in a "reach-out timelock" (it tells the bot when it does).
//  2. It has that person's privacy token. WhatsApp gives one when someone messages you, but it
//     can arrive a few seconds after their message, so the bot waits a little for it.
import { isLidUser, jidNormalizedUser } from "@whiskeysockets/baileys";

// ── 1. Reach-out timelock ──

export const lockActive = (lock, now = Date.now()) =>
  !!lock?.isActive && (!lock.timeEnforcementEnds || now < new Date(lock.timeEnforcementEnds).getTime());

// ── 2. Privacy tokens ──

// Same rule as the library: a token is good for a rolling ~28 days (4 weekly buckets).
const BUCKET = 604_800;
export function tokenGood(entry, now = Date.now()) {
  if (!entry?.token?.length) return false;
  const ts = Number(entry.timestamp);
  if (!ts) return false;
  const cutoff = (Math.floor(now / 1000 / BUCKET) - 3) * BUCKET;
  return ts >= cutoff;
}

async function storageJid(sock, jid) {
  const j = jidNormalizedUser(jid);
  if (isLidUser(j)) return j;
  return (await sock.signalRepository.lidMapping.getLIDForPN(j).catch(() => null)) || j;
}

// Whether the bot holds this person's privacy token, waiting up to `waitMs` for it to arrive.
export async function hasToken(sock, jids, { waitMs = 20_000, every = 2_000, now = Date.now } = {}) {
  const ids = [...new Set(await Promise.all(jids.filter(Boolean).map((j) => storageJid(sock, j))))];
  const until = now() + waitMs;
  for (;;) {
    const found = await sock.authState.keys.get("tctoken", ids).catch(() => ({}));
    if (ids.some((id) => tokenGood(found?.[id], now()))) return true;
    if (now() >= until) return false;
    await new Promise((r) => setTimeout(r, every));
  }
}
