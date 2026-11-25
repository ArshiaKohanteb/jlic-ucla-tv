// How long a person would take to answer: notice the message, open it, type the reply
// (sometimes stopping for a moment), and leave the app. Everything varies, so no two replies
// have the same rhythm. Pure functions of a random source, so they can be tested.

const between = (rand, lo, hi) => lo + rand() * (hi - lo);

// Before opening the message: usually a few seconds, sometimes a while.
export function readDelay(rand = Math.random) {
  const r = rand();
  if (r < 0.6) return between(rand, 2_000, 6_000);
  if (r < 0.88) return between(rand, 6_000, 14_000);
  return between(rand, 15_000, 30_000);
}

// After opening it, before starting to type.
export const thinkDelay = (rand = Math.random) => between(rand, 600, 2_500);

// "typing…" for about as long as a quick thumb-typer takes (5–8 characters a second), kept
// between 3 and 14 seconds, and about a third of the time with a pause in the middle.
// Returns steps: { typing: true|false, ms }.
export function typingPlan(text, rand = Math.random) {
  const total = Math.min(14_000, Math.max(3_000, (String(text).length / between(rand, 5, 8)) * 1000));
  if (rand() < 0.35) {
    const first = total * between(rand, 0.3, 0.7);
    return [{ typing: true, ms: first }, { typing: false, ms: between(rand, 800, 3_000) }, { typing: true, ms: total - first }];
  }
  return [{ typing: true, ms: total }];
}

// After sending, before leaving the app (going offline).
export const lingerDelay = (rand = Math.random) => between(rand, 4_000, 20_000);

// Between two people's replies when several ask at once.
export const gapBetweenReplies = (rand = Math.random) => between(rand, 3_000, 10_000);

// One of several ways to say the same thing.
export const pickOne = (options, rand = Math.random) => options[Math.floor(rand() * options.length) % options.length];
