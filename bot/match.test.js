import test from "node:test";
import assert from "node:assert/strict";
import { timeIn, dateOf, minyanFor, readOption, choiceOf } from "./match.js";

// Monday, November 2 2026, 8 PM in Los Angeles
const MON_EVENING = Date.parse("2026-11-03T04:00:00Z");

test("times", () => {
  assert.equal(timeIn("9:00 AM"), "09:00");
  assert.equal(timeIn("9am"), "09:00");
  assert.equal(timeIn("1:10 pm"), "13:10");
  assert.equal(timeIn("21:00"), "21:00");
  assert.equal(timeIn("8", ["08:00", "09:00"]), "08:00");
  assert.equal(timeIn("1:10", [], "Mincha"), "13:10");
  assert.equal(timeIn("7:30", [], "Shacharit"), "07:30");
  assert.equal(timeIn("Yes"), null);
  assert.equal(timeIn("I'm in!"), null);
  // Typos without the colon
  assert.equal(timeIn("333 pm"), "15:33");
  assert.equal(timeIn("1030", [], "Shacharit"), "10:30");
  assert.equal(timeIn("730am"), "07:30");
  assert.equal(timeIn("130", [], "Mincha"), "13:30");
  // Times that can't be right for the minyan
  assert.equal(timeIn("2am", [], "Mincha"), "14:00");
  assert.equal(timeIn("11:00", [], "Mincha"), null);
  assert.equal(timeIn("7pm", [], "Shacharit"), "07:00");
  assert.equal(timeIn("3am", [], "Shacharit"), null);
  assert.equal(timeIn("12:30 am", [], "Maariv"), "00:30");
  assert.equal(timeIn("2am"), "02:00");
});

test("dates", () => {
  assert.equal(dateOf("Shacharit tomorrow?", MON_EVENING), "2026-11-03");
  assert.equal(dateOf("Mincha today", MON_EVENING), "2026-11-02");
  assert.equal(dateOf("Thursday shacharis", MON_EVENING), "2026-11-05");
  assert.equal(dateOf("Who's coming?", MON_EVENING), "2026-11-03");
});

test("minyan", () => {
  const list = [
    { id: "s", name: "Shacharit", days: [1, 2, 3, 4] },
    { id: "m", name: "Mincha", days: [0, 1, 2, 3, 4] },
  ];
  assert.equal(minyanFor("Shacharis tomorrow?", list, "2026-11-03").id, "s");
  assert.equal(minyanFor("mincha at 1:10?", list, "2026-11-03").id, "m");
  assert.equal(minyanFor("Who's coming?", list, "2026-11-03"), null);
  assert.equal(minyanFor("Who's coming?", [list[0]], "2026-11-03").id, "s");
  assert.equal(minyanFor("Pizza Thursday?", list, "2026-11-05"), null);
});

test("options and choices", () => {
  assert.deepEqual(readOption("9:00", ["09:00"], "Shacharit"), { time: "09:00" });
  assert.deepEqual(readOption("Yes 👍", []), { yes: true });
  assert.deepEqual(readOption("Can't make it", []), { no: true });
  assert.equal(choiceOf([{ no: true }]), null);
  assert.equal(choiceOf([]), null);
  assert.deepEqual(choiceOf([{ time: "09:00" }, { time: "08:00" }]), { times: ["08:00", "09:00"] });
  assert.deepEqual(choiceOf([{ yes: true }]), { times: [] });
  // In a poll of times, an unreadable option doesn't count
  assert.equal(choiceOf([{ yes: true }], true), null);
  assert.deepEqual(choiceOf([{ yes: true }, { time: "13:00" }], true), { times: ["13:00"] });
});
