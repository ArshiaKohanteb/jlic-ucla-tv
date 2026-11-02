import React, { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, CalendarDays, Clock } from "lucide-react";
import { Card, Button, Field, Toggle, Segmented, Tabs, DaysPicker, TimeEditor, useDraft, todayKey, EditedBy } from "../ui.jsx";
import { uid, WEEKDAYS } from "../../shared/defaults.js";
import { writeTv, patchTv } from "../../shared/store.js";
import { addDays, localInfo, resolveTime, formatHHMM, fmt } from "../../shared/schedule.js";

const move = (list, i, d) => {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

function nextDateFor(weekday) {
  const t = todayKey();
  const wd = localInfo(Date.now()).weekday;
  return addDays(t, (weekday - wd + 7) % 7);
}

const ZMAN_SHORT = { sunrise: "Sunrise", hatzot: "Chatzot", minchaGedola: "Mincha Gedola", plag: "Plag", sunset: "Sunset", tzet: "Tzet", alot: "Alot", misheyakir: "Misheyakir", candleLighting: "Candles", havdalah: "Havdalah", rabbeinuTam: "R. Tam" };

function timeLabel(spec, preview) {
  if (!spec) return null;
  if (spec.type === "fixed") return spec.value ? formatHHMM(spec.value) : null;
  const off = Number(spec.offset) || 0;
  const rel = `${off ? (off < 0 ? "−" : "+") + Math.abs(off) + " " : ""}${ZMAN_SHORT[spec.zman] || spec.zman}`;
  return preview ? `${fmt(preview)} · ${rel}` : rel;
}

function ItemRow({ item, onChange, onDelete, onUp, onDown, mode, z, open, onToggle }) {
  const set = (patch) => onChange({ ...item, ...patch });
  const previewDate = mode === "shabbat" ? nextDateFor(item.day === "fri" ? 5 : 6)
    : mode === "daily" ? nextDateFor((item.days || [])[0] ?? 0) : todayKey();
  const preview = z ? resolveTime(item.time, previewDate, z) : null;
  const label = timeLabel(item.time, preview);
  const sub = mode === "daily" ? daysSummary(item.days) : mode === "shabbat" ? (item.day === "fri" ? "Friday" : "Shabbat") : "";
  return (
    <div className={`time-row ${open ? "open" : ""}`}>
      <div className="time-row-main">
        <div className="order">
          <button onClick={onUp} aria-label="Move up"><ChevronUp size={16} /></button>
          <button onClick={onDown} aria-label="Move down"><ChevronDown size={16} /></button>
        </div>
        <input className="input input-name" placeholder="Name (e.g. Mincha)" value={item.name || ""} onChange={(e) => set({ name: e.target.value })} />
        {mode === "daily" ? (
          <input className="input input-note" placeholder="Note (optional)" value={item.note || ""} onChange={(e) => set({ note: e.target.value })} />
        ) : <span className="input-note sub">{sub}</span>}
        <button className={`time-chip ${label ? "" : "empty"}`} onClick={onToggle} title="Change time">
          {label || "Set time"}{mode === "daily" && sub && <small>{sub}</small>}
        </button>
        <button className="icon-btn danger" onClick={onDelete} aria-label="Delete"><Trash2 size={18} /></button>
      </div>
      <EditedBy item={item} className="row-edited" />
      {open && (
        <div className="time-row-detail">
          {mode === "daily" && <DaysPicker value={item.days || []} onChange={(days) => set({ days })} />}
          {mode === "shabbat" && (
            <Segmented small value={item.day || "sat"} onChange={(day) => set({ day })} options={[{ value: "fri", label: "Friday / Erev" }, { value: "sat", label: "Shabbat / Yom Tov day" }]} />
          )}
          <TimeEditor value={item.time} onChange={(time) => set({ time })} allowShabbat={mode !== "daily"} z={z} dateKey={previewDate} />
          {mode === "daily" && <input className="input note-mobile" placeholder="Note shown beside the name (optional)" value={item.note || ""} onChange={(e) => set({ note: e.target.value })} />}
        </div>
      )}
    </div>
  );
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function daysSummary(days = []) {
  const d = [...days].sort();
  if (d.length === 7) return "Every day";
  if (d.join() === "0,1,2,3,4") return "Sun–Thu";
  if (d.join() === "1,2,3,4,5") return "Mon–Fri";
  if (d.join() === "0,1,2,3,4,5") return "Sun–Fri";
  return d.map((x) => DAY_SHORT[x]).join(", ") || "No days";
}

function ItemList({ items, setItems, mode, z, newItem, addLabel }) {
  const [open, setOpen] = useState(null);
  return (
    <>
      {items.length === 0 && <p className="empty-state">Nothing here yet.</p>}
      <div className="times">
        {items.map((it, i) => (
          <ItemRow
            key={it.id}
            item={it}
            mode={mode}
            z={z}
            onChange={(v) => setItems(items.map((x) => (x.id === it.id ? v : x)))}
            onDelete={() => confirm(`Remove "${it.name || "this time"}"?`) && setItems(items.filter((x) => x.id !== it.id))}
            onUp={() => setItems(move(items, i, -1))}
            onDown={() => setItems(move(items, i, 1))}
            open={open === it.id}
            onToggle={() => setOpen(open === it.id ? null : it.id)}
          />
        ))}
      </div>
      <div className="times-foot">
        <Button variant="primary" icon={Plus} onClick={() => { const n = newItem(); setItems([...items, n]); setOpen(n.id); }}>{addLabel}</Button>
        <span className="hint">Tap a time to change it. Saves as you type.</span>
      </div>
    </>
  );
}

function Weekday({ tv, z }) {
  const [items, setItems] = useDraft(tv.minyanim, (v) => writeTv("minyanim", v));
  return (
    <Card title="Weekday minyanim" subtitle="Each time can run on any days, at a set time or relative to a zman. On Yom Tov these are hidden automatically." icon={Clock}>
      <ItemList items={items} setItems={setItems} mode="daily" z={z} addLabel="Add a minyan"
        newItem={() => ({ id: uid(), name: "", note: "", days: [...WEEKDAYS], time: { type: "fixed", value: "" } })} />
    </Card>
  );
}

function Shabbat({ tv, z }) {
  const [items, setItems] = useDraft(tv.shabbat, (v) => writeTv("shabbat", v));
  return (
    <>
      <Card title="Shabbat & Yom Tov schedule" subtitle="Used every Shabbat, and on Yom Tov unless you set up a special day. Candle lighting and havdalah fill in automatically." icon={Clock}>
        <ItemList items={items} setItems={setItems} mode="shabbat" z={z} addLabel="Add to Shabbat"
          newItem={() => ({ id: uid(), name: "", day: "sat", time: { type: "fixed", value: "" } })} />
      </Card>

    </>
  );
}

function Special({ tv, z }) {
  const [list, setList] = useDraft(tv.special, (v) => writeTv("special", v));
  const [open, setOpen] = useState(null);
  const today = todayKey();
  const update = (id, patch) => setList(list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  return (
    <Card
      title="Holidays & special days"
      subtitle="A special schedule replaces the weekday minyanim on its dates (Yom Tov, fast days, Chol HaMoed…)."
      action={<Button variant="primary" icon={Plus} onClick={() => { const id = uid(); setList([...list, { id, title: "", start: today, end: today, active: true, items: [] }]); setOpen(id); }}>New</Button>}
    >
      <div className="special-list">
        {list.length === 0 && <p className="empty-state">No special schedules. Add one before a holiday.</p>}
        {list.map((s) => {
          const live = s.active !== false && s.start <= today && (s.end || s.start) >= today;
          const past = (s.end || s.start) < today;
          return (
            <div key={s.id} className={`special ${open === s.id ? "open" : ""}`}>
              <button className="special-head" onClick={() => setOpen(open === s.id ? null : s.id)}>
                <CalendarDays size={20} />
                <span className="special-title">{s.title || "Untitled schedule"}</span>
                <span className="special-dates">{s.start}{s.end && s.end !== s.start ? ` → ${s.end}` : ""}</span>
                {live && <span className="badge badge-live">Showing now</span>}
                {past && <span className="badge">Past</span>}
              </button>
              {open === s.id && (
                <div className="special-body">
                  <EditedBy item={s} />
                  <div className="grid-3">
                    <Field label="Name shown on TV"><input className="input" placeholder="e.g. Sukkot Schedule" value={s.title} onChange={(e) => update(s.id, { title: e.target.value })} /></Field>
                    <Field label="First day"><input type="date" className="input" value={s.start} onChange={(e) => update(s.id, { start: e.target.value })} /></Field>
                    <Field label="Last day"><input type="date" className="input" value={s.end} onChange={(e) => update(s.id, { end: e.target.value })} /></Field>
                  </div>
                  <Toggle label="Active" checked={s.active !== false} onChange={(active) => update(s.id, { active })} />
                  <ItemList items={s.items || []} setItems={(items) => update(s.id, { items })} mode="special" z={z} addLabel="Add a time"
                    newItem={() => ({ id: uid(), name: "", time: { type: "fixed", value: "" } })} />
                  <Button variant="ghost-danger" icon={Trash2} onClick={() => confirm("Delete this special schedule?") && setList(list.filter((x) => x.id !== s.id))}>Delete schedule</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Schedule({ tv, z }) {
  const [tab, setTab] = useState("weekday");
  return (
    <div className="stack">
      <Tabs value={tab} onChange={setTab} options={[{ value: "weekday", label: "Weekday minyanim" }, { value: "shabbat", label: "Shabbat & Yom Tov" }, { value: "special", label: "Special days" }]} />
      {tab === "weekday" && <Weekday tv={tv} z={z} />}
      {tab === "shabbat" && <Shabbat tv={tv} z={z} />}
      {tab === "special" && <Special tv={tv} z={z} />}
    </div>
  );
}
