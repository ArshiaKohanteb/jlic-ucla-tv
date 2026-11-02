import React, { useState } from "react";
import { Plus, X, Check, Pencil, Trash2, Send, Repeat } from "lucide-react";
import { Card, Button, Field, Modal, Stepper, Toggle, ClockInput, todayKey } from "../ui.jsx";
import { minyanCalendar, closeWords, needWords, TEN } from "../../shared/minyan.js";
import { TIMEZONE, formatHHMM, addDays } from "../../shared/schedule.js";
import * as P from "../../shared/polls.js";

const ROOMS = ["Beit Midrash", "Prayer Room", "Law School 2477"];
const NAMES = ["Shacharit", "Mincha", "Arvit"];
const COMMON = { Shacharit: ["08:00", "09:00"], Mincha: ["13:10"], Arvit: ["19:00"] };

const hhmm = (t) => formatHHMM(t);
const waLink = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;
const onMessage = (o) => `Minyan is on! ${o.name} ${o.day.toLowerCase()}${o.locked || o.planned ? ` at ${hhmm(o.locked || o.planned)}` : ""}${o.place ? ` in the ${o.place}` : ""}.`;
const askMessage = (o) => `${o.name} ${o.day.toLowerCase()}: ${o.count} of ${TEN} so far. Sign up at uclaminyan.com`;

function TimesPicker({ value, onChange }) {
  const [extra, setExtra] = useState("08:00");
  return (
    <div className="pk">
      <div className="pk-chips">
        {value.map((t) => <button key={t} className="chip on" onClick={() => onChange(value.filter((x) => x !== t))}>{hhmm(t)}<X size={14} /></button>)}
      </div>
      <div className="pk-add">
        <ClockInput value={extra} onChange={setExtra} />
        <Button variant="secondary" icon={Plus} onClick={() => extra && onChange([...new Set([...value, extra])].sort())}>Add time</Button>
      </div>
    </div>
  );
}

function OpenPoll({ tv, onClose }) {
  const today = todayKey();
  const [name, setName] = useState("Shacharit");
  const [date, setDate] = useState(addDays(today, 1));
  const [times, setTimes] = useState(COMMON.Shacharit);
  const [place, setPlace] = useState("");
  const pick = (n) => { setName(n); setTimes(COMMON[n] || []); };
  const open = () => { if (name.trim() && times.length) { P.openPoll(tv, { name: name.trim(), date, times, place }); onClose(); } };
  return (
    <Modal title="Open a poll" onClose={onClose} footer={<Button variant="primary" onClick={open} disabled={!name.trim() || !times.length}>Open poll</Button>}>
      <div className="stack-sm">
        <Field label="What">
          <div className="pk-chips">
            {NAMES.map((n) => <button key={n} className={`chip ${name === n ? "on" : ""}`} onClick={() => pick(n)}>{n}</button>)}
            <input className="input pk-other" placeholder="Other" value={NAMES.includes(name) ? "" : name} onChange={(e) => setName(e.target.value)} />
          </div>
        </Field>
        <Field label="When">
          <div className="pk-chips">
            <button className={`chip ${date === today ? "on" : ""}`} onClick={() => setDate(today)}>Today</button>
            <button className={`chip ${date === addDays(today, 1) ? "on" : ""}`} onClick={() => setDate(addDays(today, 1))}>Tomorrow</button>
            <input className="input pk-other" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </Field>
        <Field label="Times" hint="Add one to just post it, or several to let people vote"><TimesPicker value={times} onChange={setTimes} /></Field>
        <Field label="Room"><input className="input" list="minyan-rooms" placeholder="Beit Midrash" value={place} onChange={(e) => setPlace(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// The people who usually come and haven't answered yet, with a nudge ready to send.
function Missing({ o, regulars }) {
  const inIds = new Set(o.people.map((p) => p.uid));
  const list = (regulars || []).filter((r) => !inIds.has(r.key) && !r.key.startsWith("n_")).slice(0, 6);
  if (!list.length || o.on || o.off) return null;
  const names = list.map((r) => r.name.split(" ")[0]);
  const text = `We need ${o.need} more for ${o.name} ${o.day.toLowerCase()}! ${names.join(", ")}, are you in? uclaminyan.com`;
  return (
    <p className="pl-missing">
      <span>Usually come: {list.map((r) => r.name).join(", ")}</span>
      <a href={waLink(text)} target="_blank" rel="noreferrer">Nudge them</a>
    </p>
  );
}

function Poll({ tv, o, regulars, now }) {
  const [edit, setEdit] = useState(false);
  const [room, setRoom] = useState(o.place);
  const [perk, setPerk] = useState(o.perk);
  const notes = [needWords(o), closeWords(o, now), o.perk, o.leader ? `Chazan: ${o.leader}` : "", o.needsReader ? (o.reader ? `Torah reader: ${o.reader}` : "No Torah reader yet") : ""].filter(Boolean);
  const here = o.people.filter((p) => p.here).length;
  const choices = o.votes?.length ? o.votes : o.times.length ? o.times.map((t) => ({ t, count: o.count })) : o.planned ? [{ t: o.planned, count: o.count }] : [];
  const state = o.off ? "Not happening" : o.on ? "We're on" : "Voting";
  const confirmed = o.locked || (o.on ? o.times[0] || o.planned : "");
  return (
    <article className={`pl ${o.on ? "is-on" : ""} ${o.off ? "is-off" : ""}`}>
      <header className="pl-head">
        <div>
          <h3 dir="auto">{o.name}</h3>
          <p>{o.day}{o.place ? ` · ${o.place}` : ""}</p>
        </div>
        <span className="pl-state">{state}</span>
      </header>

      {!o.off && (
        <div className="pl-times">
          {choices.map((x) => {
            const picked = o.on && x.t === confirmed;
            return (
              <button key={x.t} className={`pl-time ${picked ? "on" : ""}`} title={picked ? "Confirmed" : `Confirm ${hhmm(x.t)}`} onClick={() => (picked ? P.reopenPoll(tv, o) : P.confirmPoll(tv, o, x.t))}>
                <b>{hhmm(x.t)}</b>
                <span>{x.count} of {TEN}</span>
                <em>{picked ? <><Check size={14} />Confirmed</> : "Confirm"}</em>
              </button>
            );
          })}
        </div>
      )}

      {notes.length > 0 && <p className="pl-notes">{notes.join(" · ")}</p>}
      {here > 0 && <p className="pl-notes">{here} checked in</p>}
      <Missing o={o} regulars={regulars} />
      {o.people.length > 0 && <p className="pl-who">{o.people.map((p) => p.name + (p.late ? " (late)" : "")).join(", ")}{o.extra ? ` + ${o.extra}` : ""}</p>}

      <footer className="pl-actions">
        <a className="btn btn-primary" href={waLink(o.on ? onMessage(o) : askMessage(o))} target="_blank" rel="noreferrer" onClick={() => o.on && P.setMessage(tv, o, onMessage(o))}><Send size={16} /><span>{o.on ? "Tell the group" : "Ask the group"}</span></a>
        <Button variant="secondary" icon={Pencil} onClick={() => setEdit(!edit)}>Edit</Button>
        {o.off
          ? <Button variant="secondary" onClick={() => P.reopenPoll(tv, o)}>Reopen</Button>
          : <Button variant="secondary" onClick={() => P.cancelPoll(tv, o)}>Not happening</Button>}
      </footer>

      {edit && (
        <div className="pl-edit">
          <Field label="Times"><TimesPicker value={o.times.length ? o.times : o.planned ? [o.planned] : []} onChange={(list) => P.setTimes(tv, o, list)} /></Field>
          <div className="grid-2">
            <Field label="Room"><input className="input" list="minyan-rooms" placeholder="Beit Midrash" value={room} onChange={(e) => setRoom(e.target.value)} onBlur={() => room !== o.place && P.setRoom(tv, o, room)} /></Field>
            <Field label="People not on the site"><Stepper value={o.extra} min={0} max={10} onChange={(n) => P.setExtra(tv, o, n)} /></Field>
          </div>
          <Field label="Perk" hint="Shows on the site and TV"><input className="input" placeholder="Breakfast if we get ten" value={perk} onChange={(e) => setPerk(e.target.value)} onBlur={() => perk !== o.perk && P.setPerk(tv, o, perk)} /></Field>
          {o.people.length > 0 && (
            <div className="pk-chips">
              {o.people.map((p) => <button key={p.uid} className="chip" onClick={() => confirm(`Remove ${p.name}?`) && P.removePerson(o, p.uid)}>{p.name}<X size={14} /></button>)}
            </div>
          )}
          {!o.auto && <Button variant="secondary" icon={Trash2} onClick={() => confirm(`Delete this ${o.name} poll?`) && P.deletePoll(tv, o.id)}>Delete poll</Button>}
        </div>
      )}
    </article>
  );
}

function AutoRow({ tv, m }) {
  const [open, setOpen] = useState(false);
  const on = (m.days || []).length > 0;
  const times = m.options?.length ? m.options : m.time?.value ? [m.time.value] : [];
  return (
    <li className="au">
      <div className="au-row">
        <button className="au-main" onClick={() => setOpen(!open)}><b dir="auto">{m.name}</b><span>{times.map(hhmm).join(", ") || "No times yet"}{m.place ? ` · ${m.place}` : ""}</span></button>
        <Toggle checked={on} onChange={(v) => P.setAutoOn(tv, m.id, v)} />
      </div>
      {open && (
        <div className="pl-edit">
          <Field label="Times"><TimesPicker value={times} onChange={(options) => P.saveAuto(tv, m.id, { options })} /></Field>
          <Field label="Room"><input className="input" list="minyan-rooms" defaultValue={m.place || ""} placeholder="Beit Midrash" onBlur={(e) => P.saveAuto(tv, m.id, { place: e.target.value })} /></Field>
          <Button variant="secondary" icon={Trash2} onClick={() => confirm(`Stop and delete the automatic ${m.name} poll?`) && P.deletePoll(tv, m.id)}>Delete</Button>
        </div>
      )}
    </li>
  );
}

export default function Polls({ tv, z, signups, regulars }) {
  const [opening, setOpening] = useState(false);
  const polls = minyanCalendar(tv, z, Date.now(), TIMEZONE, signups, 3).filter((o) => {
    if (!o.auto) return true;
    if (o.date === addDays(todayKey(), 1)) return true;
    return o.date === todayKey() && (o.people.length > 0 || o.on);
  });
  const autos = tv.minyanim.filter((m) => !m.date);
  return (
    <div className="stack">
      <datalist id="minyan-rooms">{ROOMS.map((r) => <option key={r} value={r} />)}</datalist>
      <div className="pl-bar"><Button variant="primary" icon={Plus} onClick={() => setOpening(true)}>Open a poll</Button></div>
      {polls.length ? <div className="pl-list">{polls.map((o) => <Poll key={o.id + o.date} tv={tv} o={o} regulars={regulars} now={Date.now()} />)}</div> : <p className="empty-state">No polls open.</p>}
      <Card title="Runs by itself" subtitle="These polls open every day for the next day, except Shabbat." icon={Repeat}>
        <ul className="au-list">{autos.map((m) => <AutoRow key={m.id} tv={tv} m={m} />)}</ul>
        <Button variant="secondary" icon={Plus} onClick={() => P.addAuto(tv, { name: "Mincha", times: ["13:10"] })}>Add a daily poll</Button>
        <Field label="Polls close the night before at" hint="A countdown runs until then. People can still vote after, as a last call."><ClockInput value={tv.settings.pollClose ?? "22:30"} onChange={P.setPollClose} /></Field>
        <Toggle label="Everyone can see who signed up" hint="Off means people only see the count" checked={tv.settings.showNames !== false} onChange={P.setShowNames} />
        <Toggle label="Turn to We're on at ten" hint="The leading time is confirmed for you" checked={tv.settings.autoConfirm !== false} onChange={P.setAutoConfirm} />
      </Card>
      {opening && <OpenPoll tv={tv} onClose={() => setOpening(false)} />}
    </div>
  );
}
