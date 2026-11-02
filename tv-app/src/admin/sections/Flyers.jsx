import React, { useRef, useState } from "react";
import { ImagePlus, Trash2, ChevronLeft, ChevronRight, Settings2, Loader2 } from "lucide-react";
import { Card, Button, Field, Toggle, Stepper, Modal, EditedBy } from "../ui.jsx";
import { uid } from "../../shared/defaults.js";
import { writeTv, patchTv } from "../../shared/store.js";
import { uploadFlyer, deleteFlyerFile, isImage, IMAGE_ACCEPT } from "../services.js";
import { status, canLink } from "./Announcements.jsx";

const shape = (f) => (f.w && f.h ? (f.w / f.h >= 1.25 ? "Horizontal" : "Vertical") : "");

function FlyerSettings({ flyer, settings, onSave, onClose }) {
  const [f, setF] = useState(flyer);
  const set = (p) => setF({ ...f, ...p });
  return (
    <Modal title="Flyer settings" onClose={onClose} footer={<>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button variant="primary" onClick={() => onSave(f)}>Save</Button>
    </>}>
      <img className="flyer-modal-img" src={f.url} alt="" />
      <Field label="Name (for you only)"><input className="input" value={f.name || ""} onChange={(e) => set({ name: e.target.value })} /></Field>
      <div className="grid-2">
        <Field label="Start showing (optional)"><input type="date" className="input" value={f.start || ""} onChange={(e) => set({ start: e.target.value })} /></Field>
        <Field label="Stop after (optional)" hint="Tip: the day after the event"><input type="date" className="input" value={f.end || ""} onChange={(e) => set({ end: e.target.value })} /></Field>
      </div>
      <Field label="Seconds on screen" hint={`Leave at 0 to use the default (${settings.flyerSeconds}s)`}>
        <Stepper value={f.seconds || 0} min={0} max={120} step={1} suffix="sec" onChange={(seconds) => set({ seconds })} />
      </Field>
      {shape(f) === "Vertical" && (
        <Toggle label="Always show by itself" hint="Otherwise vertical flyers are paired side by side" checked={!!f.solo} onChange={(solo) => set({ solo })} />
      )}
    </Modal>
  );
}

export default function Flyers({ tv }) {
  const list = [...tv.flyers].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const latest = useRef(list);
  latest.current = list;
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [editing, setEditing] = useState(null);
  const input = useRef(null);

  const save = (next) => writeTv("flyers", JSON.parse(JSON.stringify(next.map((f, i) => ({ ...f, order: i })))));

  async function upload(files) {
    const imgs = [...files].filter(isImage);
    if (!imgs.length) return;
    setError("");
    const added = [];
    for (let i = 0; i < imgs.length; i++) {
      setBusy(`Uploading ${i + 1} of ${imgs.length}…`);
      try {
        const id = uid();
        const r = await uploadFlyer(imgs[i], id);
        added.push({ id, name: imgs[i].name.replace(/\.[^.]+$/, ""), active: true, start: "", end: "", addedAt: Date.now(), ...r });
      } catch (e) {
        console.error(e);
        setError(`Couldn't upload ${imgs[i].name}. ${e.code === "storage/unauthorized" ? "Your account can't upload yet (see setup guide)." : e.message || ""}`);
      }
    }
    if (added.length) await save([...added, ...latest.current]);
    setBusy("");
  }

  const move = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  };

  const live = list.filter((f) => status(f).cls === "badge-live").length;

  return (
    <div className="stack">
      <Card title="Flyers & photos" subtitle={`${live} showing on the TV. Horizontal flyers fill the screen; vertical ones pair up side by side.`}>
        <div
          className={`drop ${drag ? "drag" : ""}`}
          onClick={() => !busy && input.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        >
          {busy ? <Loader2 className="spin" size={32} /> : <ImagePlus size={32} />}
          <b>{busy || "Add flyers"}</b>
          <span>Tap to choose from your phone or drag images here. JPG, PNG and iPhone HEIC photos all work.</span>
          <input ref={input} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </div>
        {error && <p className="error">{error}</p>}
      </Card>

      {list.length > 0 && (
        <div className="flyer-grid">
          {list.map((f, i) => {
            const st = status(f);
            return (
              <article key={f.id} className={`flyer-card ${st.cls === "badge-live" ? "" : "is-off"}`}>
                <div className="flyer-thumb" onClick={() => setEditing(f)}>
                  <img src={f.url} alt={f.name || ""} loading="lazy" />
                  <span className="flyer-shape">{shape(f)}</span>
                </div>
                <div className="flyer-meta">
                  <span className="flyer-name">{f.name || "Flyer"}</span>
                  <span className={`badge ${st.cls}`}>{st.label}{f.end && st.cls === "badge-live" ? ` · until ${f.end}` : ""}</span>
                  {(tv.announcements || []).filter((a) => a.flyerId === f.id && canLink(a)).map((a) => (
                    <span key={a.id} className="flyer-linked">Shows with “{a.title || "announcement"}”</span>
                  ))}
                  <EditedBy item={f} prefix={f.addedAt && f.editedAt - f.addedAt < 5000 ? "Added" : "Edited"} />
                </div>
                <div className="flyer-actions">
                  <button type="button" role="switch" aria-label="Show on TV" aria-checked={f.active !== false} className={`switch ${f.active !== false ? "on" : ""}`}
                    onClick={() => save(list.map((x) => (x.id === f.id ? { ...x, active: x.active === false } : x)))}><span /></button>
                  <span className="spacer" />
                  <button className="icon-btn" onClick={() => move(i, -1)} aria-label="Earlier"><ChevronLeft size={18} /></button>
                  <button className="icon-btn" onClick={() => move(i, 1)} aria-label="Later"><ChevronRight size={18} /></button>
                  <button className="icon-btn" onClick={() => setEditing(f)} aria-label="Settings"><Settings2 size={18} /></button>
                  <button className="icon-btn danger" aria-label="Delete" onClick={async () => {
                    if (!confirm("Delete this flyer?")) return;
                    await save(list.filter((x) => x.id !== f.id));
                    deleteFlyerFile(f.path);
                  }}><Trash2 size={18} /></button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Card title="Flyer layout">
        <Toggle label="Pair vertical flyers" hint="Two portrait flyers side by side instead of one at a time" checked={tv.settings.pairVerticalFlyers} onChange={(v) => patchTv("settings", { pairVerticalFlyers: v })} />
      </Card>

      {editing && (
        <FlyerSettings flyer={editing} settings={tv.settings} onClose={() => setEditing(null)}
          onSave={(f) => { save(list.map((x) => (x.id === f.id ? f : x))); setEditing(null); }} />
      )}
    </div>
  );
}
