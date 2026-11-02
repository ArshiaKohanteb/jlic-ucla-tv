import React, { useRef, useState } from "react";
import { MapPin, MonitorSmartphone, Users, DatabaseBackup, Crosshair, RotateCw, Moon, Download, Upload, AlertTriangle, Check } from "lucide-react";
import { Card, Field, Toggle, Stepper, Button, Tabs, useDraft, clean } from "../ui.jsx";
import { patchTv, writeTv } from "../../shared/store.js";
import { DEFAULT_TV } from "../../shared/defaults.js";
import { ScreenLinks } from "./Home.jsx";
import Managers from "./Managers.jsx";

const TIMEZONES = ["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "Asia/Jerusalem", "Europe/London"];

function Location({ s }) {
  const [loc, setLoc] = useState(s.location);
  const [saved, setSaved] = useState(false);
  const set = (p) => { setLoc({ ...loc, ...p }); setSaved(false); };
  const dirty = JSON.stringify(loc) !== JSON.stringify(s.location);

  function here() {
    navigator.geolocation?.getCurrentPosition(
      (p) => set({ lat: +p.coords.latitude.toFixed(6), long: +p.coords.longitude.toFixed(6) }),
      () => alert("Couldn't get this device's location."),
    );
  }
  async function save() {
    await patchTv("settings", { location: clean(loc), reloadToken: Date.now() });
    setSaved(true);
  }

  return (
    <>
      <Card title="Location" subtitle="Every zman, candle lighting and havdalah is calculated for this spot." icon={MapPin}
        action={<Button variant="secondary" icon={Crosshair} onClick={here}>Use my location</Button>}>
        <div className="grid-2">
          <Field label="Place name"><input className="input" value={loc.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Time zone">
            <select className="input" value={loc.timezone} onChange={(e) => set({ timezone: e.target.value })}>
              {[...new Set([loc.timezone, ...TIMEZONES])].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </Field>
          <Field label="Latitude"><input className="input" inputMode="decimal" value={loc.lat} onChange={(e) => set({ lat: e.target.value })} /></Field>
          <Field label="Longitude"><input className="input" inputMode="decimal" value={loc.long} onChange={(e) => set({ long: e.target.value })} /></Field>
          <Field label="Elevation (meters)" hint="Leave at 0 unless your Rav says otherwise"><input className="input" inputMode="decimal" value={loc.elevation} onChange={(e) => set({ elevation: e.target.value })} /></Field>
        </div>
      </Card>
      <Card title="Shabbat & Yom Tov times" icon={Moon}>
        <div className="grid-2">
          <Field label="Candle lighting" hint="Minutes before sunset. Many LA shuls use 18 or 20.">
            <Stepper value={Number(loc.candleLighting)} min={10} max={40} suffix="min" onChange={(v) => set({ candleLighting: v })} />
          </Field>
          <Field label="Shabbat ends (havdalah)" hint="Minutes after sunset">
            <Stepper value={Number(loc.tzeitMinutes)} min={20} max={72} suffix="min" onChange={(v) => set({ tzeitMinutes: v })} />
          </Field>
        </div>
        <div className="row-actions">
          <Button variant="primary" icon={saved ? Check : RotateCw} disabled={!dirty && !saved} onClick={save}>{saved ? "Saved, screens restarting" : "Save & restart screens"}</Button>
          {dirty && <Button variant="ghost" onClick={() => setLoc(s.location)}>Undo</Button>}
        </div>
      </Card>
    </>
  );
}

function Screens({ s }) {
  const set = (p) => patchTv("settings", p);
  const dim = s.nightDim || {};
  const [reload, setReload] = useDraft(s.dailyReload || "03:30", (v) => set({ dailyReload: v }));
  return (
    <>
      <Card title="Screen addresses" subtitle="Open one of these in the TV's browser. Each TV picks its own." icon={MonitorSmartphone}>
        <ScreenLinks />
        <div className="row-actions">
          <Button variant="secondary" icon={RotateCw} onClick={() => confirm("Restart every screen?") && set({ reloadToken: Date.now() })}>Restart all screens</Button>
        </div>
      </Card>
      <Card title="Night dimming" subtitle="Dim the screen overnight so it isn't glaring in an empty room." icon={Moon}>
        <Toggle label="Dim at night" checked={!!dim.enabled} onChange={(v) => set({ nightDim: { ...dim, enabled: v } })} />
        {dim.enabled && (
          <div className="grid-3">
            <Field label="From"><input type="time" className="input" value={dim.start} onChange={(e) => set({ nightDim: { ...dim, start: e.target.value } })} /></Field>
            <Field label="Until"><input type="time" className="input" value={dim.end} onChange={(e) => set({ nightDim: { ...dim, end: e.target.value } })} /></Field>
            <Field label="Brightness"><Stepper value={Number(dim.level) || 40} min={10} max={90} step={10} suffix="%" onChange={(v) => set({ nightDim: { ...dim, level: v } })} /></Field>
          </div>
        )}
      </Card>
      <Card title="Performance">
        <div className="toggle-list">
          <Toggle label="Lighter effects" hint="Turns off glass blur and moving light for slower TVs" checked={s.effects === "lite"} onChange={(v) => set({ effects: v ? "lite" : "full" })} />
        </div>
        <Field label="Daily refresh" hint="Each screen reloads itself once a day to stay smooth.">
          <input type="time" className="input" style={{ maxWidth: 180 }} value={reload} onChange={(e) => setReload(e.target.value)} />
        </Field>
      </Card>
    </>
  );
}

const KEYS = ["settings", "minyanim", "shabbat", "special", "announcements", "flyers", "photos"];

function Backup({ tv }) {
  const input = useRef(null);
  const [msg, setMsg] = useState("");

  function download() {
    const blob = new Blob([JSON.stringify(tv, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jlic-ucla-tv-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function restore(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data.settings) throw new Error("That file isn't a TV backup.");
      if (!confirm("Replace everything on the TV with this backup?")) return;
      for (const k of KEYS) if (k in data) await writeTv(k, clean(data[k]));
      setMsg("Backup restored.");
    } catch (e) {
      setMsg(e.message);
    }
  }
  async function reset() {
    if (prompt('This erases all times, slides and settings. Type RESET to continue.') !== "RESET") return;
    for (const k of KEYS) await writeTv(k, clean(DEFAULT_TV[k] ?? []));
    setMsg("Reset to the starting setup.");
  }

  return (
    <>
      <Card title="Backups" subtitle="Download everything (times, slides, settings, photo links) as one file. Keep a copy before big changes." icon={DatabaseBackup}>
        <div className="row-actions">
          <Button variant="primary" icon={Download} onClick={download}>Download backup</Button>
          <Button variant="secondary" icon={Upload} onClick={() => input.current.click()}>Restore from file</Button>
          <input ref={input} type="file" accept="application/json" hidden onChange={(e) => { restore(e.target.files[0]); e.target.value = ""; }} />
        </div>
        {msg && <p className="success"><Check size={16} /> {msg}</p>}
      </Card>
      <Card title="Start over" icon={AlertTriangle}>
        <p className="sub">Puts back the starting times and settings. Photos stay in storage, but the TV forgets them.</p>
        <Button variant="danger" onClick={reset}>Reset everything</Button>
      </Card>
    </>
  );
}

export default function Settings({ tv, user }) {
  const [tab, setTab] = useState("location");
  return (
    <div className="stack">
      <div className="owner-note"><AlertTriangle size={17} /> Only owners see this page. Changes here affect every screen.</div>
      <Tabs value={tab} onChange={setTab} options={[
        { value: "location", label: "Location & zmanim", icon: MapPin },
        { value: "screens", label: "Screens", icon: MonitorSmartphone },
        { value: "people", label: "People", icon: Users },
        { value: "backup", label: "Backup", icon: DatabaseBackup },
      ]} />
      {tab === "location" && <Location s={tv.settings} />}
      {tab === "screens" && <Screens s={tv.settings} />}
      {tab === "people" && <Managers user={user} />}
      {tab === "backup" && <Backup tv={tv} />}
    </div>
  );
}
