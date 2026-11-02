import React, { useRef, useState } from "react";
import { ImagePlus, Trash2, Loader2, Shuffle } from "lucide-react";
import { Card, Field, Toggle, Stepper, useDraft, EditedBy } from "../ui.jsx";
import { uid } from "../../shared/defaults.js";
import { writeTv, patchTv } from "../../shared/store.js";
import { uploadFlyer, deleteFlyerFile, isImage, IMAGE_ACCEPT } from "../services.js";

export default function Photos({ tv }) {
  const list = tv.photos || [];
  const latest = useRef(list);
  latest.current = list;
  const input = useRef(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const s = tv.settings;
  const [title, setTitle] = useDraft(s.communityTitle || "Our Community", (v) => patchTv("settings", { communityTitle: v }));

  const save = (next) => writeTv("photos", JSON.parse(JSON.stringify(next)));

  async function upload(files) {
    const imgs = [...files].filter(isImage);
    if (!imgs.length) return;
    setError("");
    const added = [];
    for (let i = 0; i < imgs.length; i++) {
      setBusy(`Uploading ${i + 1} of ${imgs.length}…`);
      try {
        const id = uid();
        added.push({ id, active: true, addedAt: Date.now(), ...(await uploadFlyer(imgs[i], id, "photos")) });
      } catch (e) {
        console.error(e);
        setError(`Couldn't upload ${imgs[i].name}.`);
      }
    }
    if (added.length) await save([...added, ...latest.current]);
    setBusy("");
  }

  const active = list.filter((p) => p.active !== false).length;

  return (
    <div className="stack">
      <Card title="Community photos" subtitle={`${active} in the library. Each time the collage comes up, the TV picks a fresh random handful, so it never repeats the same set.`}>
        <div
          className={`drop ${drag ? "drag" : ""}`}
          onClick={() => !busy && input.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        >
          {busy ? <Loader2 className="spin" size={32} /> : <ImagePlus size={32} />}
          <b>{busy || "Add photos"}</b>
          <span>Pick as many as you like from your phone: kiddush, events, the kids, simchas. JPG, PNG and iPhone HEIC all work. At least 3 are needed for the collage.</span>
          <input ref={input} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </div>
        {error && <p className="error">{error}</p>}
      </Card>

      {list.length > 0 && (
        <div className="photo-grid">
          {list.map((p) => (
            <figure key={p.id} className={`photo ${p.active === false ? "is-off" : ""}`}>
              <img src={p.url} alt="" loading="lazy" />
              <EditedBy item={p} prefix={p.addedAt && p.editedAt - p.addedAt < 5000 ? "Added" : "Edited"} className="photo-edited" />
              <div className="photo-actions">
                <button type="button" role="switch" aria-label="Use in collage" aria-checked={p.active !== false} className={`switch ${p.active !== false ? "on" : ""}`}
                  onClick={() => save(list.map((x) => (x.id === p.id ? { ...x, active: x.active === false } : x)))}><span /></button>
                <button className="icon-btn danger" aria-label="Delete" onClick={async () => {
                  if (!confirm("Delete this photo?")) return;
                  await save(list.filter((x) => x.id !== p.id));
                  deleteFlyerFile(p.path);
                }}><Trash2 size={18} /></button>
              </div>
            </figure>
          ))}
        </div>
      )}

      <Card title="Collage settings">
        <Toggle label="Show the community collage" checked={s.showCommunity !== false} onChange={(v) => patchTv("settings", { showCommunity: v })} />
        <div className="grid-2">
          <Field label="Title on screen"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field label="Seconds on screen"><Stepper value={s.communitySeconds || 16} min={8} max={60} step={2} suffix="sec" onChange={(v) => patchTv("settings", { communitySeconds: v })} /></Field>
        </div>
        <p className="hint"><Shuffle size={14} style={{ verticalAlign: "-2px" }} /> The layout changes each time too.</p>
      </Card>
    </div>
  );
}
