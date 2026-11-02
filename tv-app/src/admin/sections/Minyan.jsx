import React, { useEffect, useMemo, useState } from "react";
import { Trophy, ListChecks, Plus, X, Trash2 } from "lucide-react";
import { Card, Button, Field, Stepper, Toggle, Tabs, ClockInput, todayKey } from "../ui.jsx";
import LiveMinyan from "./LiveMinyan.jsx";
import { uid } from "../../shared/defaults.js";
import { subscribeAllSignups } from "../../shared/signups.js";
import { subscribeAttendance, saveCorrection, buildLog, buildStats } from "../../shared/attendance.js";
import { formatHHMM } from "../../shared/schedule.js";

const niceDate = (date) => new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(date + "T12:00:00Z"));

function Entry({ e, known }) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState("");
  const fix = (patch) => saveCorrection(e.date, e.id, JSON.parse(JSON.stringify({ ...e.correction, ...patch })));
  const fixPerson = (key, value) => fix({ people: { ...(e.correction.people || {}), [key]: value } });
  const remove = (p) => (p.added ? (() => { const { [p.key]: _, ...rest } = e.correction.people || {}; return fix({ people: rest }); })() : fixPerson(p.key, false));
  const add = () => {
    const name = adding.trim();
    if (!name) return;
    const match = known.find((k) => k.name.toLowerCase() === name.toLowerCase());
    if (match && e.people.some((p) => p.key === match.key)) { setAdding(""); return; }
    fixPerson(match?.key || "n_" + uid(), { name: match?.name || name });
    setAdding("");
  };
  return (
    <li className={`log-row ${e.held ? "" : "log-off"}`}>
      <button className="log-head" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="log-date">{niceDate(e.date)}</span>
        <b dir="auto">{e.name}</b>
        <span>{e.time ? formatHHMM(e.time) : ""}</span>
        <span className="log-count">{e.held ? `${e.total} came` : "Didn't happen"}{e.edited ? " · edited" : ""}</span>
      </button>
      {open && (
        <div className="log-body">
          <Toggle label="This minyan happened" checked={e.held} onChange={(held) => fix({ held })} />
          <div className="grid-2">
            <Field label="Time"><ClockInput value={e.time} onChange={(time) => fix({ time })} /></Field>
            <Field label="Extra people" hint="Came, but aren't on the site"><Stepper value={e.extra} min={0} max={60} onChange={(extra) => fix({ extra })} /></Field>
          </div>
          <ul className="live-people">
            {e.people.map((p) => (
              <li key={p.key}>{p.name}<button aria-label={`Remove ${p.name}`} onClick={() => remove(p)}><X size={14} /></button></li>
            ))}
          </ul>
          <div className="live-add">
            <input className="input" list="log-people" placeholder="Add someone who came" value={adding} onChange={(ev) => setAdding(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && add()} />
            <Button variant="secondary" icon={Plus} onClick={add}>Add</Button>
          </div>
          {e.edited && <Button variant="secondary" icon={Trash2} onClick={() => saveCorrection(e.date, e.id, null)}>{e.manual ? "Delete this entry" : "Undo my edits"}</Button>}
        </div>
      )}
    </li>
  );
}

function Log({ log, known, today }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ date: today, name: "Shacharit", time: "09:00" });
  return (
    <Card title="Who came" subtitle="Built from sign-ups. Open any minyan to fix it, and your changes count in the stats." icon={ListChecks}
      action={<Button variant="primary" icon={Plus} onClick={() => setAdding(!adding)}>Add a minyan</Button>}>
      <datalist id="log-people">{known.map((k) => <option key={k.key} value={k.name} />)}</datalist>
      {adding && (
        <div className="live-row live-new">
          <div className="grid-2">
            <Field label="Name"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Date"><input className="input" type="date" max={today} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          </div>
          <Field label="Time"><ClockInput value={f.time} onChange={(time) => setF({ ...f, time })} /></Field>
          <div className="row-actions">
            <Button variant="primary" onClick={() => { saveCorrection(f.date, "m_" + uid(), { ...f, held: true, manual: true, extra: 0 }); setAdding(false); }}>Add to the log</Button>
          </div>
        </div>
      )}
      {log.length ? <ul className="log">{log.map((e) => <Entry key={e.key} e={e} known={known} />)}</ul> : <p className="empty-state">Past minyanim will appear here the day after they happen.</p>}
    </Card>
  );
}

function Stat({ value, label }) {
  return <div className="stat-tile"><b>{value}</b><span>{label}</span></div>;
}

function Stats({ s }) {
  if (!s.held) return <Card title="Stats" icon={Trophy}><p className="empty-state">Stats start after the first minyan that reaches ten, or that you mark as happened in the log.</p></Card>;
  return (
    <>
      <div className="stat-tiles">
        <Stat value={s.held} label="minyanim held" />
        <Stat value={s.attended} label="people came in total" />
        <Stat value={s.average} label="people per minyan" />
        <Stat value={s.people} label="different people" />
        <Stat value={s.thisMonth} label="held this month" />
        <Stat value={s.shacharit} label="Shacharit" />
        <Stat value={s.mincha} label="Mincha" />
        <Stat value={s.missed} label="didn't reach ten" />
      </div>
      <div className="grid-2">
        <Card title="Records" icon={Trophy}>
          <dl className="records">
            {s.biggest && <div><dt>Biggest minyan</dt><dd>{s.biggest.total} people, {s.biggest.name}, {niceDate(s.biggest.date)}</dd></div>}
            {s.busiest && <div><dt>Most minyanim on</dt><dd>{s.busiest}</dd></div>}
            {s.streak && <div><dt>Longest streak</dt><dd>{s.streak.name}, {s.streak.best} in a row</dd></div>}
          </dl>
        </Card>
        <Card title="Who comes most" icon={ListChecks}>
          <table className="board-table">
            <thead><tr><th>Name</th><th>Came</th><th>Shacharit</th><th>Mincha</th><th>Streak</th></tr></thead>
            <tbody>{s.board.slice(0, 25).map((p) => <tr key={p.key}><td>{p.name}</td><td><b>{p.count}</b></td><td>{p.shacharit}</td><td>{p.mincha}</td><td>{p.current}</td></tr>)}</tbody>
          </table>
        </Card>
      </div>
    </>
  );
}

export default function Minyan({ tv, z }) {
  const [tab, setTab] = useState("live");
  const [signups, setSignups] = useState({});
  const [attendance, setAttendance] = useState({});
  useEffect(() => subscribeAllSignups(setSignups), []);
  useEffect(() => subscribeAttendance(setAttendance), []);
  const today = todayKey();
  const log = useMemo(() => buildLog(tv, signups, attendance, today), [tv, signups, attendance, today]);
  const stats = useMemo(() => buildStats(log, today), [log, today]);
  const known = useMemo(() => {
    const m = new Map();
    for (const e of log) for (const p of e.people) m.set(p.key, { key: p.key, name: p.name });
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [log]);
  return (
    <div className="stack">
      <Tabs value={tab} onChange={setTab} options={[{ value: "live", label: "Coming up" }, { value: "log", label: "Log" }, { value: "stats", label: "Stats" }]} />
      {tab === "live" && <LiveMinyan tv={tv} z={z} signups={signups} />}
      {tab === "log" && <Log log={log} known={known} today={today} />}
      {tab === "stats" && <Stats s={stats} />}
    </div>
  );
}
