import React, { useState } from "react";
import { ExternalLink, RotateCw, PauseCircle } from "lucide-react";
import { Segmented, Toggle } from "../ui.jsx";
import { patchTv, isDemo } from "../../shared/store.js";

// The TV exactly as it is right now, beside whatever you're editing.
// On phones the preview only loads on request, so the dashboard stays light.
const SMALL = typeof window !== "undefined" && window.matchMedia("(max-width: 1000px)").matches;

export default function LivePreview({ tv, inline = false, controls = true }) {
  const [hold, setHold] = useState("");
  const [show, setShow] = useState(!SMALL);
  const src = `${import.meta.env.BASE_URL}?preview${isDemo() ? "&demo" : ""}${hold ? `&hold=${hold}` : ""}${SMALL ? "&lite" : ""}`;
  const s = tv.settings;
  return (
    <>
      <div className="rail-card">
        <div className="rail-title">
          <span>Live on the TV</span>
          <a className="icon-btn" href={src} target="_blank" rel="noreferrer" aria-label="Open full screen" title="Open full screen"><ExternalLink size={17} /></a>
        </div>
        <div className="preview">
          {show ? <iframe key={src} src={src} title="TV preview" />
            : <button className="preview-start" onClick={() => setShow(true)}>Tap to load the live preview</button>}
        </div>
        <Segmented small value={hold} onChange={setHold} options={[
          { value: "", label: "Rotation" }, { value: "schedule", label: "Times" },
          { value: "flyer", label: "Flyers" }, { value: "announcement", label: "Slides" }, { value: "community", label: "Collage" }, { value: "donate", label: "Donate" }, { value: "logo", label: "Logo" },
        ]} />
      </div>
      {!inline && controls && (
        <div className="rail-card">
          <div className="rail-title"><span>Quick controls</span></div>
          <div className="toggle-list">
            <Toggle label="Times only" hint="Pause flyers, slides and the collage" checked={s.contentPaused} onChange={(v) => patchTv("settings", { contentPaused: v })} />
            <Toggle label="Lighter effects" hint="For a TV that looks choppy" checked={s.effects === "lite"} onChange={(v) => patchTv("settings", { effects: v ? "lite" : "full" })} />
          </div>
          <button className="btn btn-secondary" onClick={() => confirm("Restart every screen showing the display?") && patchTv("settings", { reloadToken: Date.now() })}>
            <RotateCw size={17} /><span>Restart screens</span>
          </button>
        </div>
      )}
    </>
  );
}
