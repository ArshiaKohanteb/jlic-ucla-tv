import React, { useState } from "react";
import { Plus, Pencil, Trash2, Megaphone, PartyPopper, UtensilsCrossed } from "lucide-react";
import { Card, Button, Field, Toggle, Modal, todayKey, EditedBy } from "../ui.jsx";
import { uid, ANNOUNCEMENT_STYLES, OCCASIONS, MEALS, DEDICATIONS } from "../../shared/defaults.js";
import { writeTv } from "../../shared/store.js";

export function status(item, today = todayKey()) {
  if (item.active === false) return { label: "Off", cls: "" };
  if (item.start && item.start > today) return { label: `Starts ${item.start}`, cls: "badge-soon" };
  if (item.end && item.end < today) return { label: "Ended", cls: "" };
  return { label: "On TV", cls: "badge-live" };
}

// Announcement styles with their own artwork don't take a flyer.
export const canLink = (a) => !["celebration", "sponsor"].includes(a.style);

function FlyerLink({ flyers, value, onChange }) {
  return (
    <div className="link-pick">
      <button type="button" className={`link-none ${!value ? "on" : ""}`} onClick={() => onChange("")}>No flyer</button>
      {flyers.map((f) => (
        <button type="button" key={f.id} className={value === f.id ? "on" : ""} title={f.name || ""} onClick={() => onChange(f.id)}>
          <img src={f.url} alt={f.name || ""} loading="lazy" />
        </button>
      ))}
    </div>
  );
}

function Editor({ initial, flyers = [], onSave, onClose }) {
  const [a, setA] = useState(initial);
  const set = (p) => setA({ ...a, ...p });
  return (
    <Modal
      title={initial.title || initial.body ? "Edit announcement" : "New announcement"}
      onClose={onClose}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!a.title && !a.body} onClick={() => onSave(a)}>Save</Button>
      </>}
    >
      <Field label="Type">
        <div className="style-pick">
          {Object.entries(ANNOUNCEMENT_STYLES).map(([k, v]) => (
            <button key={k} type="button" className={`style-opt style-${k} ${a.style === k ? "on" : ""}`} onClick={() => set({ style: k })}>
              <b>{v.label}</b><span>{v.hint}</span>
            </button>
          ))}
        </div>
      </Field>
      {a.style === "celebration" ? (
        <>
          <Field label="Occasion">
            <div className="chip-pick chip-pick-solid">
              {Object.entries(OCCASIONS).map(([k, o]) => (
                <button type="button" key={k} className={(a.occasion || "wedding") === k ? "on" : ""} onClick={() => set({ occasion: k, line: undefined })}>{o.label}</button>
              ))}
            </div>
          </Field>
          <Field label="Line above the names" hint="Shown small, above the names">
            <input className="input" value={a.line ?? (OCCASIONS[a.occasion || "wedding"]?.line || "")} onChange={(e) => set({ line: e.target.value })} />
          </Field>
          <Field label="Names" hint="Shown huge. e.g. Daniel & Rachel, or The Cohen family">
            <input className="input" maxLength={70} value={a.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Message (optional)">
            <input className="input" maxLength={140} value={a.body} placeholder="Wishing the families much nachat" onChange={(e) => set({ body: e.target.value })} />
          </Field>
        </>
      ) : a.style === "sponsor" ? (
        <>
          <Field label="Meal">
            <div className="chip-pick chip-pick-solid">
              {MEALS.map((m) => (
                <button type="button" key={m} className={(a.meal || "Kiddush") === m ? "on" : ""} onClick={() => set({ meal: m })}>{m}</button>
              ))}
            </div>
          </Field>
          <Field label="Sponsored by"><input className="input" maxLength={60} value={a.title} placeholder="The Shirazi family" onChange={(e) => set({ title: e.target.value })} /></Field>
          <Field label="Dedication">
            <select className="input" value={a.dedication || "none"} onChange={(e) => set({ dedication: e.target.value })}>
              {Object.entries(DEDICATIONS).map(([k, v]) => <option key={k} value={k}>{v || "No dedication"}</option>)}
            </select>
          </Field>
          {(a.dedication || "none") !== "none" && (
            <Field label="Who it's for"><input className="input" maxLength={70} value={a.body} placeholder='Yosef ben Rachel z"l' onChange={(e) => set({ body: e.target.value })} /></Field>
          )}
        </>
      ) : (
        <>
          <Field label="Headline" hint="Short and big. Shows huge on the full-screen slide.">
            <input className="input" maxLength={90} value={a.title} placeholder="e.g. Rosh Chodesh Minyan at 6:15" onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Message" hint={`${(a.body || "").length}/320`}>
            <textarea className="input" rows={4} maxLength={320} value={a.body} placeholder="Details people should read from across the room." onChange={(e) => set({ body: e.target.value })} />
          </Field>
        </>
      )}
      {canLink(a) && flyers.length > 0 && (
        <Field label="Show with a flyer (optional)" hint="The flyer appears beside this announcement on one slide, instead of on its own.">
          <FlyerLink flyers={flyers} value={a.flyerId || ""} onChange={(flyerId) => set({ flyerId })} />
        </Field>
      )}
      <div className="grid-2">
        <Field label="Start showing (optional)"><input type="date" className="input" value={a.start} onChange={(e) => set({ start: e.target.value })} /></Field>
        <Field label="Stop after (optional)"><input type="date" className="input" value={a.end} onChange={(e) => set({ end: e.target.value })} /></Field>
      </div>
      <Toggle label="Full-screen slide" hint="Appears in the rotation between schedule screens" checked={a.slide !== false} onChange={(slide) => set({ slide })} />
      {(a.style || "info") === "info" && (
        <Toggle label="Bottom bar" hint="Also shows in the rotating bar under the schedule" checked={a.ticker !== false} onChange={(ticker) => set({ ticker })} />
      )}
    </Modal>
  );
}

export default function Announcements({ tv }) {
  const list = tv.announcements;
  const [editing, setEditing] = useState(null);
  const save = (next) => writeTv("announcements", JSON.parse(JSON.stringify(next)));
  const upsert = (a) => {
    save(list.some((x) => x.id === a.id) ? list.map((x) => (x.id === a.id ? a : x)) : [a, ...list]);
    setEditing(null);
  };
  const blank = (style = "info") => ({
    id: uid(), active: true, style, title: "", body: "", slide: true, ticker: style === "info", start: "", end: "",
    ...(style === "celebration" ? { occasion: "wedding" } : {}),
    ...(style === "sponsor" ? { meal: "Kiddush", dedication: "honor" } : {}),
  });

  return (
    <div className="stack">
      <Card
        title="Announcements"
        subtitle="Full-screen slides and the bottom ticker. Set dates so they take themselves down."
        action={
          <div className="row-actions">
            <Button variant="primary" icon={Plus} onClick={() => setEditing(blank())}>Announcement</Button>
            <Button icon={PartyPopper} onClick={() => setEditing(blank("celebration"))}>Mazal Tov</Button>
            <Button icon={UtensilsCrossed} onClick={() => setEditing(blank("sponsor"))}>Sponsor</Button>
          </div>
        }
      >
        {list.length === 0 && (
          <div className="empty-big">
            <Megaphone size={36} />
            <p>No announcements yet.</p>
            <Button variant="primary" icon={Plus} onClick={() => setEditing(blank())}>Write the first one</Button>
          </div>
        )}
        <div className="ann-list">
          {list.map((a) => {
            const st = status(a);
            return (
              <article key={a.id} className={`ann-item style-${a.style} ${a.active === false ? "is-off" : ""}`}>
                <div className="ann-item-body" onClick={() => setEditing(a)}>
                  <div className="ann-item-meta">
                    <span className={`tag tag-${a.style}`}>{ANNOUNCEMENT_STYLES[a.style]?.label || "Announcement"}</span>
                    <span className={`badge ${st.cls}`}>{st.label}</span>
                    {a.slide !== false && <span className="meta">Slide</span>}
                    {a.ticker !== false && (a.style || "info") === "info" && <span className="meta">Bottom bar</span>}
                    {canLink(a) && a.flyerId && (tv.flyers || []).some((f) => f.id === a.flyerId) && <span className="meta">With flyer</span>}
                    <EditedBy item={a} />
                  </div>
                  {a.title && <h4>{a.style === "sponsor" ? `${a.meal || "Kiddush"} · ${a.title}` : a.title}</h4>}
                  {(a.body || a.style === "celebration") && <p>{a.style === "celebration" ? (a.line ?? OCCASIONS[a.occasion]?.line ?? "") + (a.body ? " · " + a.body : "") : a.body}</p>}
                </div>
                <div className="ann-item-actions">
                  <button type="button" role="switch" aria-label="Show on TV" aria-checked={a.active !== false} className={`switch ${a.active !== false ? "on" : ""}`}
                    onClick={() => save(list.map((x) => (x.id === a.id ? { ...x, active: x.active === false } : x)))}><span /></button>
                  <button className="icon-btn" onClick={() => setEditing(a)} aria-label="Edit"><Pencil size={18} /></button>
                  <button className="icon-btn danger" onClick={() => confirm("Delete this announcement?") && save(list.filter((x) => x.id !== a.id))} aria-label="Delete"><Trash2 size={18} /></button>
                </div>
              </article>
            );
          })}
        </div>
      </Card>
      {editing && <Editor flyers={tv.flyers || []} initial={editing} onSave={upsert} onClose={() => setEditing(null)} />}
    </div>
  );
}
