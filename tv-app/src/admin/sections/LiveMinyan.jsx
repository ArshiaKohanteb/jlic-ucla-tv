import React from "react";
import { Users } from "lucide-react";
import { Card, Stepper, Segmented, Field, ClockInput, useDraft } from "../ui.jsx";
import { writeTv } from "../../shared/store.js";
import { upcomingMinyanim, liveFor, TEN } from "../../shared/minyan.js";
import { TIMEZONE, formatHHMM } from "../../shared/schedule.js";

const ROOMS = ["Beit Midrash", "Prayer Room", "Law School 2477"];

function Row({ o, items, setItems }) {
  const m = items.find((x) => x.id === o.id) || o.item;
  const live = liveFor(m, o.date) || { date: o.date, state: "voting", count: 0 };
  const put = (patch) => setItems(items.map((x) => (x.id === m.id ? { ...x, live: { ...live, ...patch, date: o.date } } : x)));
  const setCount = (count) => put({ count, state: count >= TEN ? "on" : live.state === "on" ? "voting" : live.state || "voting" });
  const planned = o.item.time?.type === "fixed" ? o.item.time.value : "";
  return (
    <div className="live-row">
      <div className="live-title"><b dir="auto">{m.name || "Minyan"}</b><span>{o.day}{planned ? ` · usually ${formatHHMM(planned)}` : ""}</span></div>
      <Segmented value={live.state === "off" ? "off" : live.state === "on" ? "on" : "voting"} onChange={(state) => put({ state })}
        options={[{ value: "voting", label: "Still voting" }, { value: "on", label: "We're on" }, { value: "off", label: "Not today" }]} />
      <div className="grid-2">
        <Field label="Votes so far"><Stepper value={live.count || 0} min={0} max={TEN} onChange={setCount} suffix={`of ${TEN}`} /></Field>
        <Field label="Time"><ClockInput value={live.time || planned} onChange={(time) => put({ time })} /></Field>
      </div>
      <Field label="Room">
        <input className="input" list="minyan-rooms" placeholder="Beit Midrash" value={live.place || ""} onChange={(e) => put({ place: e.target.value })} />
      </Field>
    </div>
  );
}

// The quick controls for the night before: how many votes, and are we on.
export default function LiveMinyan({ tv, z }) {
  const [items, setItems] = useDraft(tv.minyanim, (v) => writeTv("minyanim", v));
  const list = upcomingMinyanim({ ...tv, minyanim: items }, z, Date.now(), TIMEZONE, 3);
  if (!list.length) return null;
  return (
    <Card title="Are we on?" subtitle="Update this as the poll moves. It shows on the TV in seconds and resets by itself each day." icon={Users}>
      <datalist id="minyan-rooms">{ROOMS.map((r) => <option key={r} value={r} />)}</datalist>
      <div className="live-list">
        {list.map((o) => <Row key={o.id + o.date} o={o} items={items} setItems={setItems} />)}
      </div>
    </Card>
  );
}
