// Every change an admin makes to a poll, used by the dashboard and the sign-up site alike.
// A poll is one minyan on one day. Automatic polls repeat each day; the others are one-offs.
import { uid } from "./defaults.js";
import { writeTv, patchTv } from "./store.js";
import { removeSignup } from "./signups.js";

const save = (list) => writeTv("minyanim", JSON.parse(JSON.stringify(list)));

function setLive(tv, o, patch) {
  return save(tv.minyanim.map((m) => {
    if (m.id !== o.id) return m;
    const live = m.live?.date === o.date ? m.live : { date: o.date, state: "voting", count: 0 };
    return { ...m, live: { ...live, ...patch, date: o.date } };
  }));
}

export const confirmPoll = (tv, o, time) => setLive(tv, o, { state: "on", ...(time ? { time } : {}) });
export const cancelPoll = (tv, o) => setLive(tv, o, { state: "off" });
export const reopenPoll = (tv, o) => setLive(tv, o, { state: "voting", time: "" });
export const setRoom = (tv, o, place) => setLive(tv, o, { place });
export const setExtra = (tv, o, count) => setLive(tv, o, { count });
export const setMessage = (tv, o, message) => setLive(tv, o, { message });
export const timesOf = (o) => (o.times || []);
export const setTimes = (tv, o, options) => setLive(tv, o, { options: [...new Set(options)].sort() });
export const removePerson = (o, personId) => removeSignup(o.date, o.id, personId);

export function openPoll(tv, { name, date, times, place }) {
  const list = [...new Set(times)].sort();
  return save([...tv.minyanim, { id: uid(), name, note: "", date, place: place || "", options: list, time: { type: "fixed", value: list[0] || "" } }]);
}
export const deletePoll = (tv, id) => save(tv.minyanim.filter((m) => m.id !== id));

// Automatic polls open by themselves for the next day. Shabbat is skipped.
const EVERY_DAY = [0, 1, 2, 3, 4, 5];
export function saveAuto(tv, id, patch) {
  return save(tv.minyanim.map((m) => {
    if (m.id !== id) return m;
    const next = { ...m, ...patch };
    const first = (next.options || [])[0];
    return { ...next, ...(first ? { time: { type: "fixed", value: first } } : {}) };
  }));
}
export const setAutoOn = (tv, id, on) => saveAuto(tv, id, { days: on ? EVERY_DAY : [] });
export const addAuto = (tv, { name, times, place }) => {
  const list = [...new Set(times)].sort();
  return save([...tv.minyanim, { id: uid(), name, note: "", days: EVERY_DAY, place: place || "", options: list, time: { type: "fixed", value: list[0] || "" } }]);
};
export const setAutoConfirm = (on) => patchTv("settings", { autoConfirm: on });
