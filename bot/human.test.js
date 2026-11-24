import test from "node:test";
import assert from "node:assert/strict";
import { readDelay, thinkDelay, typingPlan, lingerDelay, gapBetweenReplies, pickOne } from "./human.js";
import { lunchReply } from "./lunch.js";

// A repeatable random source.
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

test("timings stay in range and vary", () => {
  const rand = seeded(42);
  const reads = Array.from({ length: 500 }, () => readDelay(rand));
  assert.ok(reads.every((ms) => ms >= 2_000 && ms <= 30_000));
  assert.ok(reads.some((ms) => ms < 6_000) && reads.some((ms) => ms > 15_000), "mostly quick, sometimes slow");
  assert.ok(new Set(reads.map((ms) => Math.round(ms / 500))).size > 20, "not the same every time");
  for (let i = 0; i < 200; i++) {
    const t = thinkDelay(rand), l = lingerDelay(rand), g = gapBetweenReplies(rand);
    assert.ok(t >= 600 && t <= 2_500 && l >= 4_000 && l <= 20_000 && g >= 3_000 && g <= 10_000);
  }
});

test("typing takes about as long as the reply, sometimes with a pause", () => {
  const rand = seeded(7);
  const reply = lunchReply({ ticket: "abc123abc123abc1", left: 2 }, () => 0);
  const plans = Array.from({ length: 300 }, () => typingPlan(reply, rand));
  for (const p of plans) {
    const typed = p.filter((s) => s.typing).reduce((n, s) => n + s.ms, 0);
    assert.ok(typed >= 3_000 && typed <= 14_000);
    assert.ok(p.length === 1 || (p.length === 3 && !p[1].typing));
  }
  const paused = plans.filter((p) => p.length === 3).length;
  assert.ok(paused > 60 && paused < 160, `about a third pause (${paused}/300)`);
  assert.ok(typingPlan("ok", rand).reduce((n, s) => n + s.ms, 0) >= 3_000, "short replies still take a moment");
});

test("replies are worded different ways", () => {
  const rand = seeded(3);
  const seen = new Set(Array.from({ length: 50 }, () => lunchReply({ ticket: "abc", left: 1 }, rand)));
  assert.ok(seen.size >= 4);
  for (const s of seen) assert.match(s, /lunch\/#abc/);
  assert.equal(pickOne(["a", "b"], () => 0.99), "b");
});
