import test from "node:test";
import assert from "node:assert/strict";
import { timeIn, dateOf, minyanFor, readOption, choiceOf, readPoll, kindOf, minyanOf } from "./match.js";

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
  // Tomorrow, misspelled
  for (const w of ["Shacharit Tommorrow?", "tomorow", "tmrw mincha", "tomorrow's shacharit", "tmr"]) assert.equal(dateOf(w, MON_EVENING), "2026-11-03", w);
  // A date
  assert.equal(dateOf("Shacharit 11/5", MON_EVENING), "2026-11-05");
  assert.equal(dateOf("Mincha Nov 4th", MON_EVENING), "2026-11-04");
  assert.equal(dateOf("Shacharit December 1", MON_EVENING), "2026-12-01");
  assert.equal(dateOf("Mincha 1/3", MON_EVENING), "2027-01-03");
});

test("no day named: today if that minyan is still ahead", () => {
  const list = [
    { id: "s", name: "Shacharit", days: [0, 1, 2, 3, 4, 5], options: ["07:30", "08:00"] },
    { id: "m", name: "Mincha", days: [0, 1, 2, 3, 4], time: { type: "fixed", value: "13:45" } },
  ];
  const at = (hhmm) => Date.parse(`2026-11-02T${hhmm}:00-08:00`); // Monday in LA
  assert.equal(dateOf("Mincha?", at("09:00"), list), "2026-11-02");
  assert.equal(dateOf("Mincha?", at("15:00"), list), "2026-11-03");
  assert.equal(dateOf("Shacharit", at("06:00"), list), "2026-11-02");
  assert.equal(dateOf("Shacharit", at("08:30"), list), "2026-11-03");
  // The poll's own times count too: a 4 PM option is still ahead at 3 PM.
  assert.equal(dateOf("Mincha?", at("15:00"), list, ["3:30", "4"]), "2026-11-02");
  // Named days still win.
  assert.equal(dateOf("Mincha tomorrow", at("09:00"), list), "2026-11-03");
  // Not a day that minyan runs (Mincha has no Saturday): tomorrow.
  assert.equal(dateOf("Mincha?", Date.parse("2026-11-07T09:00:00-08:00"), list), "2026-11-08");
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

// Real polls from the minyan group (questions and options as posted; nobody's name).
test("real polls: which prayer, which day, which times", () => {
  const list = [{ id: "s", name: "Shacharit", days: [1, 2, 3, 4], time: { type: "fixed", value: "09:00" } }];
  const at = (s) => Date.parse(s + ":00-07:00");
  const read = (q, opts, when) => {
    const r = readPoll(q, opts, list, at(when));
    return r && [r.kind, r.date, r.options.map((o) => (o.time ? (o.kind === r.kind ? o.time : `${o.time} ${o.kind}`) : o.no ? "no" : "-")).join(" ")];
  };
  const shach = ["7:30", "8:00", "8:30", "9:00", "Netz at Dodger Stadium at the 42nd inning stretch"];
  const four = "07:30 08:00 08:30 09:00 -";

  // Shacharit, by many names, for the next day
  assert.deepEqual(read("Prayer of the dawn, first day of school! (Fifth day)", [...shach.slice(0, 4), "What do you mean, I'm still on summer break"], "2026-09-23T16:03"), ["shacharit", "2026-09-24", four]);
  assert.deepEqual(read("Morning services, first weekday of the appointed time, Feast of Booths (Monday Chol Hamoed Sukkot)", shach, "2026-09-27T20:48"), ["shacharit", "2026-09-28", four]);
  assert.deepEqual(read("Seven Circumambulations of the Grand Salvation (Hoshana Rabbah shacharit)", ["8:30", "9:00", "Davening elsewhere"], "2026-10-01T14:20"), ["shacharit", "2026-10-02", "08:30 09:00 -"]);
  assert.deepEqual(read("שחרית, ב׳ בשבת, פרשת בראשית(Monday shacharit)", shach, "2026-10-04T20:34"), ["shacharit", "2026-10-05", four]);
  assert.deepEqual(read("שחרית ו׳ בשבת, פרשת לך לל", shach, "2026-10-22T15:27"), ["shacharit", "2026-10-23", four]);
  assert.deepEqual(read("ראש חודש חשון, תשפ״ז (Monday Rosh Chodesh Shacharit) — *please only vote for times at which you're available for 75 minutes*", shach, "2026-10-10T20:17"), ["shacharit", "2026-10-12", four]);
  assert.deepEqual(read("Optimal Tuesday minyan", ["8:00", "9:00"], "2026-11-23T16:21"), ["shacharit", "2026-11-24", "08:00 09:00"]);

  // Mincha ("Meal offering" is its literal meaning), the same day
  assert.deepEqual(read("Meal offering", ["12:07", "1 (following chabura)", "2", "3"], "2026-11-02T10:39"), ["mincha", "2026-11-02", "12:07 13:00 14:00 15:00"]);
  assert.deepEqual(read("Grain offering", ["1:16", "2", "3"], "2026-09-24T09:01"), ["mincha", "2026-09-24", "13:16 14:00 15:00"]);
  assert.deepEqual(read("Mincha/musaf", ["12:07 (can also be musaf only)", "1", "2", "3"], "2026-11-10T09:25"), ["mincha", "2026-11-10", "12:07 13:00 14:00 15:00"]);
  // A yes/no poll with the time in the question
  assert.deepEqual(read("Mincha 115", ["Yes", "Sorry"], "2026-11-10T13:12"), ["mincha", "2026-11-10", "13:15 no"]);
  assert.deepEqual(read("Early mincha 1:13", ["In", "Can't"], "2026-10-02T11:12"), ["mincha", "2026-10-02", "13:13 no"]);

  // Mincha with Maariv, and Kabbalat Shabbat, are Mincha/Arvit
  assert.deepEqual(read("Meal offering", ["1:13", "2", "3", "6:25 mincha/maariv during Jewing dinner (standalone maariv also possible)"], "2026-09-30T10:40"), ["mincha", "2026-09-30", "13:13 14:00 15:00 18:25 mincha-arvit"]);
  assert.deepEqual(read("Meal offering", ["12:07", "1", "2", "3", "4:45 with maariv (standalone maariv during Jewing dinner also possible)"], "2026-11-04T10:19"), ["mincha", "2026-11-04", "12:07 13:00 14:00 15:00 16:45 mincha-arvit"]);
  assert.deepEqual(read("Mincha and/or maariv", ["1:11", "2", "3", "Plag mincha/maariv at 5:05 during Jewing dinner", "Shkia mincha maariv at 6:15 during Jewing dinner", "Post vigil maariv ~8:45"], "2026-10-07T10:11"),
    ["mincha", "2026-10-07", "13:11 14:00 15:00 17:05 mincha-arvit 18:15 mincha-arvit 20:45 arvit"]);
  assert.deepEqual(read("Mincha/Kabbalat Shabbat Tonight 5:55 PM?", ["YES", "NO"], "2026-10-23T08:44"), ["mincha-arvit", "2026-10-23", "17:55 no"]);
  assert.deepEqual(read("Carlbach kabshab tnt? 6:40ish", ["Yes", "No"], "2026-10-02T15:41"), ["mincha-arvit", "2026-10-02", "18:40 no"]);

  // Arvit
  assert.deepEqual(read("Arvit anyone?", ["6 (pre dinner)", "6:30 (mid din)", "7 (post din)"], "2026-11-18T17:40"), ["arvit", "2026-11-18", "18:00 18:30 19:00"]);

  // Not minyan polls
  assert.equal(read("Who should make the mincha poll?", ["Someone else", "There shouldn't be a mincha poll"], "2026-10-14T12:39"), null);
  assert.equal(read("Use of translated English names for services in the poll", ["Tired old shtick and I don't like it", "Good shtick, keep it up"], "2026-09-24T15:05"), null);
});

test("kinds", () => {
  assert.equal(kindOf("Shacharit"), "shacharit");
  assert.equal(kindOf("Mincha"), "mincha");
  assert.equal(kindOf("Mincha/Arvit"), "mincha-arvit");
  assert.equal(kindOf("Maariv"), "arvit");
  assert.equal(kindOf("Mincha/Kabbalat Shabbat Tonight"), "mincha-arvit"); // not Arvit for "tonight"
  assert.equal(kindOf("מנחה"), "mincha");
  assert.equal(kindOf("ערבית"), "arvit");
  // The site's minyan for each, without mixing up Mincha and Mincha/Arvit
  const list = [{ id: "ma", name: "Mincha/Arvit", days: [] }, { id: "m", name: "Mincha", days: [1] }];
  assert.equal(minyanOf("mincha", list, "2026-11-02").id, "m");
  assert.equal(minyanOf("mincha-arvit", list, "2026-11-02").id, "ma");
  assert.equal(minyanOf("arvit", list, "2026-11-02"), null);
});
