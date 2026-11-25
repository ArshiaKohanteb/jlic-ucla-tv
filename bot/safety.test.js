import test from "node:test";
import assert from "node:assert/strict";
import { hasToken, lockActive, tokenGood } from "./safety.js";

test("reach-out timelock", () => {
  const now = Date.parse("2026-11-24T15:00:00Z");
  assert.equal(lockActive(null, now), false);
  assert.equal(lockActive({ isActive: false }, now), false);
  assert.equal(lockActive({ isActive: true }, now), true); // no end given: treat as on
  assert.equal(lockActive({ isActive: true, timeEnforcementEnds: new Date(now + 60_000) }, now), true);
  assert.equal(lockActive({ isActive: true, timeEnforcementEnds: new Date(now - 1) }, now), false);
});

test("privacy tokens: present, empty, or older than ~4 weeks", () => {
  const now = Date.parse("2026-11-24T15:00:00Z");
  const sec = Math.floor(now / 1000);
  assert.equal(tokenGood({ token: Buffer.from("x"), timestamp: String(sec - 3600) }, now), true);
  assert.equal(tokenGood({ token: Buffer.alloc(0), timestamp: String(sec) }, now), false);
  assert.equal(tokenGood({ token: Buffer.from("x") }, now), false);
  assert.equal(tokenGood({ token: Buffer.from("x"), timestamp: String(sec - 40 * 86_400) }, now), false);
  assert.equal(tokenGood(null, now), false);
});

// A stand-in for the WhatsApp socket: tokens stored under the person's LID.
function fakeSock(store) {
  return {
    authState: { keys: { get: async (type, ids) => Object.fromEntries(ids.map((id) => [id, store[id] ?? null])) } },
    signalRepository: { lidMapping: { getLIDForPN: async (pn) => (pn === "18185550100@s.whatsapp.net" ? "99999@lid" : null) } },
  };
}

test("waiting for someone's privacy token", async () => {
  const sec = () => String(Math.floor(Date.now() / 1000));
  const store = {};
  const sock = fakeSock(store);
  // Never arrives: no.
  assert.equal(await hasToken(sock, ["18185550100@s.whatsapp.net"], { waitMs: 50, every: 10 }), false);
  // Arrives a moment later, under their LID: yes.
  setTimeout(() => { store["99999@lid"] = { token: Buffer.from("t"), timestamp: sec() }; }, 30);
  assert.equal(await hasToken(sock, ["18185550100@s.whatsapp.net"], { waitMs: 500, every: 10 }), true);
});
