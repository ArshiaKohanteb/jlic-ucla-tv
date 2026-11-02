import React, { useState } from "react";
import { Users, Plus, X, Check } from "lucide-react";
import { Card, Stepper, Segmented, Field, Button, ClockInput, useDraft, todayKey } from "../ui.jsx";
import { uid } from "../../shared/defaults.js";
import { writeTv } from "../../shared/store.js";
import { minyanCalendar, liveFor } from "../../shared/minyan.js";
import { removeSignup } from "../../shared/signups.js";
import { TIMEZONE, formatHHMM, formatEpoch } from "../../shared/schedule.js";

const ROOMS = ["Beit Midrash", "Prayer Room", "Law School 2477"];

function Row({ o, items, setItems }) {
  const m = items.find((x) => x.id === o.id) || o.item;
  const live = liveFor(m, o.date) || { date: o.date, state: "voting", count: 0 };
  const put = (patch) => setItems(items.map((x) => (x.id === m.id ? { ...x, live: { ...live, ...patch, date: o.date } } : x)));
  const planned = o.item.time?.type === "fixed" ? o.item.time.value : "";
  return (
    <div className="live-row">
      <div className="live-title"><b dir="auto">{m.name || "Minyan"}</b><span>{o.day}{planned ? ` · ${formatHHMM(planned)}` : ""} · {o.count} of 10</span></div>
      <Segmented value={live.state === "off" ? "off" : live.state === "on" ? "on" : "voting"} onChange={(state) => put({ state })}
        options={[{ value: "voting", label: "Automatic" }, { value: "on", label: "We're on" }, { value: "off", label: "Not today" }]} />
      {o.people.length > 0 && (
        <ul className="live-people">
          {o.people.map((p) => (
            <li key={p.uid}>{p.name}{p.counts === false ? " (not counted)" : ""}{p.late ? " · late" : ""}
              <button aria-label={`Remove ${p.name}`} onClick={() => confirm(`Remove ${p.name}?`) && removeSignup(o.date, o.id, p.uid)}><X size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid-2">
        <Field label="Extra people" hint="Coming but not signed up on the site"><Stepper value={live.count || 0} min={0} max={10} onChange={(count) => put({ count })} /></Field>
        <Field label="Time"><ClockInput value={live.time || planned} onChange={(time) => put({ time })} /></Field>
      </div>
      <Field label="Room">
        <input className="input" list="minyan-rooms" placeholder="Beit Midrash" value={live.place || ""} onChange={(e) => put({ place: e.target.value })} />
      </Field>
      <TimePoll o={o} live={live} put={put} planned={planned} />
      <SendWhatsApp o={o} onSent={(message) => put({ message })} />
    </div>
  );
}

// Opens WhatsApp with the words filled in, to send to the group. WhatsApp has no free
// way to message people automatically, so a person presses send.
function SendWhatsApp({ o, onSent }) {
  const time = o.epoch != null ? formatEpoch(o.epoch, TIMEZONE) : null;
  const [body, setBody] = useState(`Minyan is on! ${o.name} ${o.day.toLowerCase()}${time ? ` at ${time.time} ${time.ampm}` : ""}${o.place ? ` in the ${o.place}` : ""}.`);
  return (
    <div className="live-text">
      <Field label="Message the group" hint="Opens WhatsApp so you can pick the group. It also shows on the sign-up site.">
        <textarea className="input" rows={2} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <a className="btn btn-primary live-send" href={`https://wa.me/?text=${encodeURIComponent(body)}`} target="_blank" rel="noreferrer" onClick={() => onSent(body)}>Send on WhatsApp</a>
    </div>
  );
}

// Offer a few times and let the votes decide. Picking one closes the poll.
function TimePoll({ o, live, put, planned }) {
  const [adding, setAdding] = useState("08:00");
  const options = [...new Set(live.options || [])].sort();
  const set = (list) => put({ options: list });
  if (live.time && options.length) {
    return (
      <div className="live-poll">
        <span className="hint">Time set to {formatHHMM(live.time)}.</span>
        <Button variant="secondary" onClick={() => put({ time: "" })}>Reopen the vote</Button>
      </div>
    );
  }
  return (
    <div className="live-poll">
      <Field label="Suggested times" hint="People vote for every time that works, and the leading time shows on the TV">
        <ul className="live-people">
          {options.map((t) => {
            const votes = o.options?.find((x) => x.t === t)?.count ?? 0;
            return (
              <li key={t}>{formatHHMM(t)} · {votes}
                <button aria-label={`Use ${formatHHMM(t)}`} title="Use this time" onClick={() => put({ time: t })}><Check size={14} /></button>
                <button aria-label={`Remove ${formatHHMM(t)}`} onClick={() => set(options.filter((x) => x !== t))}><X size={14} /></button>
              </li>
            );
          })}
        </ul>
      </Field>
      <div className="live-add">
        <ClockInput value={adding} onChange={setAdding} />
        <Button variant="secondary" icon={Plus} onClick={() => adding && set([...new Set([...(options.length ? options : planned ? [planned] : []), adding])])}>Add time</Button>
      </div>
    </div>
  );
}

function NewMinyan({ onAdd, onClose }) {
  const [f, setF] = useState({ name: "Shacharit", date: todayKey(), time: "09:00", place: "" });
  const set = (patch) => setF({ ...f, ...patch });
  return (
    <div className="live-row live-new">
      <div className="grid-2">
        <Field label="Name"><input className="input" list="minyan-names" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Date"><input className="input" type="date" min={todayKey()} value={f.date} onChange={(e) => set({ date: e.target.value })} /></Field>
      </div>
      <Field label="Time"><ClockInput value={f.time} onChange={(time) => set({ time })} /></Field>
      <Field label="Room"><input className="input" list="minyan-rooms" placeholder="Beit Midrash" value={f.place} onChange={(e) => set({ place: e.target.value })} /></Field>
      <div className="row-actions">
        <Button variant="primary" onClick={() => { if (f.name.trim() && f.date && f.time) onAdd({ id: uid(), name: f.name.trim(), note: "", date: f.date, place: f.place, time: { type: "fixed", value: f.time } }); }}>Open for sign-ups</Button>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}

// Who's signed up, and the admin's overrides. Sign-ups turn it to "We're on" at ten by themselves.
export default function LiveMinyan({ tv, z, signups }) {
  const [items, setItems] = useDraft(tv.minyanim, (v) => writeTv("minyanim", v));
  const [adding, setAdding] = useState(false);
  const list = minyanCalendar({ ...tv, minyanim: items }, z, Date.now(), TIMEZONE, signups).slice(0, 4);
  return (
    <Card title="Coming up" subtitle="People sign up on the site and it counts itself. Use this to offer times, open a minyan or change anything." icon={Users}>
      <datalist id="minyan-rooms">{ROOMS.map((r) => <option key={r} value={r} />)}</datalist>
      <datalist id="minyan-names">{["Shacharit", "Mincha", "Arvit", "Mincha & Arvit"].map((r) => <option key={r} value={r} />)}</datalist>
      <div className="live-list">
        {list.map((o) => <Row key={o.id + o.date} o={o} items={items} setItems={setItems} />)}
        {adding
          ? <NewMinyan onClose={() => setAdding(false)} onAdd={(m) => { setItems([...items, m]); setAdding(false); }} />
          : <div className="row-actions"><Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>Create a minyan</Button></div>}
      </div>
    </Card>
  );
}
