// Reads minyan polls in the WhatsApp group and adds each vote to the sign-ups, live,
// so the site, dashboard and TV count WhatsApp and the site together.
//
// Also answers "lunch" in a direct message with a free-lunch ticket (lunch.js).
//
// It is a linked device on its own WhatsApp number (like WhatsApp Web). Link it from the
// dashboard (Minyan → WhatsApp), which shows the code. Everything else is in README.md.
import { createHash } from "node:crypto";
// firebase-admin 13+ only has the per-service imports (admin.database() is gone).
import { initializeApp, cert } from "firebase-admin/app";
import { getDatabase, ServerValue } from "firebase-admin/database";
import { getAuth } from "firebase-admin/auth";
import pino from "pino";
import makeWASocket, {
  Browsers, DisconnectReason, decryptPollVote, fetchLatestBaileysVersion,
  isJidGroup, isLidUser, isPnUser, jidNormalizedUser, normalizeMessageContent,
} from "@whiskeysockets/baileys";
import { useDbAuthState } from "./auth.js";
import { asList, choiceOf, kindName, minyanOf, readPoll } from "./match.js";
import { asksForLunch, claimLunch, lunchReply } from "./lunch.js";

const GROUP = (process.env.WA_GROUP || "minyan").toLowerCase();
const PHONE = (process.env.WA_PHONE || "").replace(/\D/g, "");
const DAY = 86_400_000;

// For a test on one computer: with FIREBASE_DATABASE_EMULATOR_HOST set (e.g. 127.0.0.1:9000)
// it talks to the local database emulator instead, and needs no key.
const EMULATOR = !!process.env.FIREBASE_DATABASE_EMULATOR_HOST;
initializeApp({
  ...(EMULATOR ? { projectId: "jlic-ucla-tv" } : { credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}")) }),
  databaseURL: process.env.FIREBASE_DATABASE_URL || "https://jlic-ucla-tv.firebaseio.com",
});
const db = getDatabase();
const log = pino({ level: process.env.LOG_LEVEL || "info" });
const quiet = pino({ level: "warn" });

const status = (patch) => db.ref("waBot/status").update({ ...patch, at: ServerValue.TIMESTAMP }).catch((e) => log.warn(e, "status"));
const sha = (s) => createHash("sha256").update(s).digest("hex");
const digits = (jid) => (jid || "").split("@")[0].split(":")[0];

// ── Who's who: a WhatsApp number that matches a site account counts as that person ──

let people = { at: 0, byPhone: new Map(), users: {} };
async function directory() {
  if (Date.now() - people.at < 5 * 60_000) return people;
  const byPhone = new Map();
  const users = (await db.ref("users").get()).val() || {};
  for (const [uid, u] of Object.entries(users)) if (u?.phone) byPhone.set(u.phone.replace(/\D/g, ""), uid);
  let page;
  // The local test has no sign-in accounts to look through.
  if (!EMULATOR) do {
    page = await getAuth().listUsers(1000, page?.pageToken);
    for (const u of page.users) if (u.phoneNumber) byPhone.set(u.phoneNumber.replace(/\D/g, ""), u.uid);
  } while (page.pageToken);
  people = { at: Date.now(), byPhone, users };
  return people;
}

// ── Groups ──

const subjects = new Map();
async function isMinyanGroup(sock, jid) {
  if (!isJidGroup(jid)) return false;
  if (!subjects.has(jid)) subjects.set(jid, (await sock.groupMetadata(jid).catch(() => null))?.subject || "");
  return subjects.get(jid).toLowerCase().includes(GROUP);
}

// ── Polls ──

const pollRef = (id) => db.ref(`waBot/polls/${id.replace(/[.#$[\]/]/g, "_")}`);
const meIds = (sock) => [sock.user?.id, sock.user?.lid].filter(Boolean).map(jidNormalizedUser);
const authors = (sock, key) => (key.fromMe ? meIds(sock) : [key.participant, key.participantAlt].filter(Boolean).map(jidNormalizedUser));

async function minyanim() {
  return (await db.ref("tv/minyanim").get()).val() || [];
}
const keyOf = (raw, id) => (Array.isArray(raw) ? raw.findIndex((x) => x?.id === id) : Object.keys(raw).find((k) => raw[k]?.id === id));

// The site's minyan for a kind of prayer. One that isn't set up yet is added with no regular
// days, so the TV only shows it on a day it has a poll; an admin can rename or schedule it.
async function ensureMinyan(kind, date) {
  let found = null;
  await db.ref("tv/minyanim").transaction((cur) => {
    const list = asList(cur);
    found = minyanOf(kind, list, date);
    if (found) return undefined;
    found = { id: kind, name: kindName(kind), note: "", days: [], place: "", options: [], time: { type: "fixed", value: "" }, auto: true };
    return [...list, found];
  });
  if (found?.auto) log.info({ minyan: found.name }, "added a minyan the site didn't have");
  return found;
}

async function onPollCreated(sock, msg, poll) {
  const question = poll.name || "";
  const sentAt = Number(msg.messageTimestamp || 0) * 1000 || Date.now();
  const options = (poll.options || []).map((o) => o.optionName || "");
  const plan = readPoll(question, options, await minyanim(), sentAt);
  const record = {
    question, sentAt, options,
    creators: authors(sock, msg.key),
    secret: Buffer.from(msg.message?.messageContextInfo?.messageSecret || []).toString("base64"),
  };
  if (!plan) {
    await pollRef(msg.key.id).set(record);
    return log.info({ question }, "poll isn't about a minyan; ignoring it");
  }

  // Each kind of prayer in the poll gets its minyan ("6:25 mincha/maariv" in a Mincha poll
  // goes to Mincha/Arvit).
  const kinds = [...new Set([plan.kind, ...plan.options.filter((o) => o.time).map((o) => o.kind)])];
  const ids = {};
  for (const k of kinds) ids[k] = (await ensureMinyan(k, plan.date)).id;
  await pollRef(msg.key.id).set({ ...record, date: plan.date, kind: plan.kind, read: plan.options, minyanIds: ids, minyanId: ids[plan.kind] });

  const unread = plan.options.filter((o) => o.yes).map((o) => o.text);
  if (unread.length) log.warn({ question, options: unread }, "these options aren't times; votes for them won't count");
  const names = kinds.map(kindName).join(" + ");
  log.info({ question, minyan: names, date: plan.date, times: plan.options.filter((o) => o.time).map((o) => `${o.time} ${kindName(o.kind)}`) }, "minyan poll");
  status({ lastPoll: `${question} (${names}, ${plan.date})` });

  // The poll's times become each minyan's choices for that day.
  const raw = await minyanim();
  for (const k of kinds) {
    const times = [...new Set(plan.options.filter((o) => o.kind === k && o.time).map((o) => o.time))];
    const key = keyOf(raw, ids[k]);
    if (!times.length || key == null || key === -1) continue;
    await db.ref(`tv/minyanim/${key}/live`).transaction((live) => {
      const mine = live?.date === plan.date ? live : { date: plan.date, state: "voting", count: 0 };
      return { ...mine, options: [...new Set([...asList(mine.options), ...times])].sort() };
    });
  }
}

function decrypt(update, poll, voters) {
  const pollEncKey = Buffer.from(poll.secret, "base64");
  for (const pollCreatorJid of poll.creators) {
    for (const voterJid of voters) {
      try {
        return decryptPollVote(update.vote, { pollEncKey, pollCreatorJid, pollMsgId: update.pollCreationMessageKey.id, voterJid });
      } catch { /* try the voter's other address */ }
    }
  }
  return null;
}

// Who a WhatsApp address is: their site account if the number matches one, otherwise a key
// made from the number (never the number itself). Votes and lunch requests use the same key.
async function personOf(sock, jids) {
  let pn = jids.find(isPnUser);
  const lid = jids.find(isLidUser);
  if (!pn && lid) pn = await sock.signalRepository.lidMapping.getPNForLID(lid).catch(() => null);
  const dir = await directory();
  const uid = pn ? dir.byPhone.get(digits(pn)) : null;
  const user = uid ? dir.users[uid] : null;
  return { key: uid || "wa_" + sha(digits(pn || lid || jids[0])).slice(0, 16), uid, user };
}

// A direct message. The bot only answers "lunch"/"meal" (see lunch.js) and ignores the rest.
async function onDirect(sock, msg, content) {
  const text = content.conversation || content.extendedTextMessage?.text || "";
  if (!asksForLunch(text)) return;
  const jid = msg.key.remoteJid;
  const { key } = await personOf(sock, [jid, msg.key.remoteJidAlt].filter(Boolean).map(jidNormalizedUser));
  const result = await claimLunch(db, key);
  await sock.sendMessage(jid, { text: lunchReply(result) });
  log.info({ name: msg.pushName, ticket: !!result.ticket, again: !!result.again, left: result.left ?? result.row?.free ?? 0 }, "lunch request");
}

async function onVote(sock, msg, update) {
  const snap = await pollRef(update.pollCreationMessageKey.id).get();
  const poll = snap.val();
  if (!poll?.read || !poll.secret) return;
  const voters = authors(sock, msg.key);
  const vote = decrypt(update, { ...poll, creators: asList(poll.creators) }, voters);
  if (!vote) return log.warn({ poll: poll.question }, "couldn't read a vote");

  const read = asList(poll.read);
  const byHash = new Map(read.map((o) => [sha(o.text), o]));
  const picked = (vote.selectedOptions || []).map((h) => byHash.get(Buffer.from(h).toString("hex"))).filter(Boolean);
  const timed = read.some((o) => o.time);

  const { key, uid, user } = await personOf(sock, voters);

  // One sign-up per minyan in the poll: set where they picked a time, gone where they didn't.
  let name = (user?.name || msg.pushName || "").trim().slice(0, 40);
  const going = {};
  for (const [kind, id] of Object.entries(poll.minyanIds || { [poll.kind]: poll.minyanId })) {
    const ref = db.ref(`signups/${poll.date}/${id}/${key}`);
    const had = (await ref.get()).val();
    name = name || had?.name || "Guest";
    const choice = choiceOf(picked.filter((p) => p.kind === kind), timed);
    if (!choice) {
      if (had?.via === "whatsapp") await ref.remove();
      continue;
    }
    going[kindName(kind)] = choice.times;
    await ref.set(JSON.parse(JSON.stringify({
      ...had,
      name,
      at: had?.at || Date.now(),
      via: had ? had.via : "whatsapp",
      counts: had?.counts ?? (user ? user.counts !== false : undefined),
      times: choice.times.length ? Object.fromEntries(choice.times.map((t) => [t, true])) : undefined,
    })));
  }
  log.info({ name, going, poll: poll.question }, Object.keys(going).length ? "coming" : "not coming");
  status({ lastVote: `${name} · ${poll.question}`, lastVoteAt: Date.now() });
}

async function handle(sock, msg, fresh = false) {
  try {
    const chat = msg.key?.remoteJid;
    const content = normalizeMessageContent(msg.message);
    if (!content) return;
    // Lunch requests: only new messages (never ones replayed when the bot links), sent to it.
    if (!isJidGroup(chat) && !msg.key.fromMe && (isPnUser(chat) || isLidUser(chat))) {
      if (fresh && Number(msg.messageTimestamp || 0) * 1000 > Date.now() - 5 * 60_000) await onDirect(sock, msg, content);
      return;
    }
    if (!(await isMinyanGroup(sock, chat))) return;
    if (Number(msg.messageTimestamp || 0) * 1000 < Date.now() - 3 * DAY) return;
    const poll = content.pollCreationMessage || content.pollCreationMessageV2 || content.pollCreationMessageV3 || content.pollCreationMessageV4 || content.pollCreationMessageV5;
    if (poll) return await onPollCreated(sock, { ...msg, message: { ...content, messageContextInfo: msg.message?.messageContextInfo || content.messageContextInfo } }, poll);
    if (content.pollUpdateMessage) return await onVote(sock, msg, content.pollUpdateMessage);
  } catch (e) {
    log.error(e, "message");
  }
}

// ── Connection ──

async function start() {
  const auth = await useDbAuthState(db);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({}));
  const sock = makeWASocket({
    auth: auth.state,
    version,
    logger: quiet,
    browser: Browsers.macOS("UCLA Minyan"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
    getMessage: async () => undefined,
  });
  let asked = false;
  sock.ev.on("creds.update", auth.saveCreds);
  sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      let code = null;
      if (PHONE && !asked) { asked = true; code = await sock.requestPairingCode(PHONE).catch(() => null); }
      status({ state: "pairing", qr, ...(code ? { code } : {}) });
      log.info(code ? `Link code: ${code}` : "Waiting to be linked (scan the code in the dashboard)");
    }
    if (connection === "open") {
      subjects.clear();
      const groups = await sock.groupFetchAllParticipating().catch(() => ({}));
      const names = Object.values(groups).map((g) => g.subject).filter((s) => s.toLowerCase().includes(GROUP));
      status({ state: "online", qr: null, code: null, phone: digits(sock.user?.id), groups: names.length ? names : null });
      log.info({ groups: names }, "online");
    }
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        log.warn("logged out; waiting to be linked again");
        await auth.clear();
        status({ state: "logged-out", qr: null, code: null });
      } else status({ state: "reconnecting" });
      setTimeout(start, code === DisconnectReason.loggedOut ? 1000 : 5000);
    }
  });
  sock.ev.on("messages.upsert", async ({ messages, type }) => { for (const m of messages) await handle(sock, m, type === "notify"); });
  sock.ev.on("messaging-history.set", async ({ messages }) => {
    const recent = messages.filter((m) => Number(m.messageTimestamp || 0) * 1000 > Date.now() - 3 * DAY);
    recent.sort((a, b) => Number(a.messageTimestamp) - Number(b.messageTimestamp));
    for (const m of recent) await handle(sock, m);
  });
}

status({ state: "starting" });
start().catch((e) => { log.error(e, "start"); process.exit(1); });
process.on("unhandledRejection", (e) => log.error(e, "unhandled"));
