import test from "node:test";
import assert from "node:assert/strict";
import { asksForLunch, claimLunch, lunchReply, TICKET_MINUTES } from "./lunch.js";

// A tiny stand-in for the Firebase database: ref(path).get/set/transaction on a plain object.
function fakeDb(data) {
  const parts = (p) => p.split("/").filter(Boolean);
  const read = (p) => parts(p).reduce((o, k) => (o == null ? undefined : o[k]), data) ?? null;
  const write = (p, v) => {
    const ks = parts(p);
    let o = data;
    for (const k of ks.slice(0, -1)) o = o[k] ??= {};
    o[ks.at(-1)] = v;
  };
  return {
    data,
    ref: (p) => ({
      get: async () => ({ val: () => structuredClone(read(p)) }),
      set: async (v) => write(p, v),
      transaction: async (fn) => { const r = fn(structuredClone(read(p))); if (r !== undefined) write(p, r); },
    }),
  };
}

// Ten people at Shacharit on each of the given days; "me" is one of them.
function minyanDays(days) {
  const signups = {};
  for (const d of days) {
    const list = { wa_me: { name: "Etai Turgeman", at: 1, times: { "09:00": true } } };
    for (let i = 0; i < 9; i++) list[`wa_${i}`] = { name: `Person ${i}`, at: 2 + i, times: { "09:00": true } };
    signups[d] = { s: list };
  }
  return { tv: { minyanim: [{ id: "s", name: "Shacharit", days: [1, 2, 3, 4], time: { type: "fixed", value: "09:00" } }] }, signups };
}

test("what counts as asking for lunch", () => {
  for (const t of ["lunch", "Lunch!", "free lunch", "meal", "meal pls", " LUNCH? "]) assert.equal(asksForLunch(t), true, t);
  for (const t of ["what's for lunch", "lunch at 2?", "Meal offering", "thanks", ""]) assert.equal(asksForLunch(t), false, t);
});

test("claiming lunches", async () => {
  // Six minyanim before Tuesday Nov 24 → two lunches earned.
  const db = fakeDb(minyanDays(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-16", "2026-11-17"]));
  const noon = Date.parse("2026-11-24T12:00:00-08:00");

  const first = await claimLunch(db, "wa_me", noon);
  assert.ok(first.ticket);
  assert.equal(first.left, 1);
  assert.deepEqual(db.data.lunches.wa_me, { used: 1, name: "Etai T." });
  assert.equal(db.data.meals[first.ticket].short, "Etai T.");
  assert.equal(db.data.meals[first.ticket].expires, noon + TICKET_MINUTES * 60_000);
  assert.match(lunchReply(first, () => 0),/Show this at OKT:\n.*\/lunch\/#/);

  // Asking again while the ticket is good: the same ticket, no lunch used.
  const again = await claimLunch(db, "wa_me", noon + 5 * 60_000);
  assert.equal(again.ticket, first.ticket);
  assert.equal(db.data.lunches.wa_me.used, 1);

  // After it expires: the second lunch.
  const second = await claimLunch(db, "wa_me", noon + 30 * 60_000);
  assert.notEqual(second.ticket, first.ticket);
  assert.equal(second.left, 0);
  assert.equal(db.data.lunches.wa_me.used, 2);

  // None left.
  const none = await claimLunch(db, "wa_me", noon + 60 * 60_000);
  assert.equal(none.ticket, undefined);
  assert.equal(lunchReply(none, () => 0), "No free lunch right now. 3 more minyanim to your next one (you've been to 6).");

  // Someone the bot has never seen.
  assert.match(lunchReply(await claimLunch(db, "wa_new", noon), () => 0), /don't see any minyanim/);
});

test("extra lunches on top of the ones earned", async () => {
  const noon = Date.parse("2026-11-24T12:00:00-08:00");
  // No minyanim yet, 3 extra: three tickets, then none, and the extra stays.
  const db = fakeDb({ ...minyanDays([]), lunches: { wa_me: { used: 0, name: "Etai T.", extra: 3 } } });
  for (let i = 0; i < 3; i++) {
    const r = await claimLunch(db, "wa_me", noon + i * 30 * 60_000);
    assert.ok(r.ticket, `lunch ${i + 1}`);
    assert.equal(r.left, 2 - i);
  }
  assert.deepEqual(db.data.lunches.wa_me, { used: 3, name: "Etai T.", extra: 3 });
  assert.equal((await claimLunch(db, "wa_me", noon + 4 * 30 * 60_000)).ticket, undefined);

  // With minyanim too: 6 minyanim (2) + 3 extra = 5.
  const both = fakeDb({ ...minyanDays(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-16", "2026-11-17"]), lunches: { wa_me: { used: 0, name: "Etai T.", extra: 3 } } });
  assert.equal((await claimLunch(both, "wa_me", noon)).left, 4);
});
