import React, { useState } from "react";
import { Check, Palette, LayoutTemplate, Repeat, Clock, Type, Sun, Moon } from "lucide-react";
import { Card, Field, Toggle, Stepper, Segmented, Tabs, useDraft } from "../ui.jsx";
import { THEMES, THEME_OPTIONS } from "../../shared/themes.js";
import { patchTv } from "../../shared/store.js";
import { HEBREW_FONTS, useHebrewFont } from "../../shared/fonts.js";
import jsQR from "jsqr";
import { decodeImage, IMAGE_ACCEPT } from "../services.js";
import { QrCode, Trash2 } from "lucide-react";

function Swatch({ id }) {
  if (id === "auto") {
    return (
      <div className="swatch swatch-split">
        <Swatch id="ivory" />
        <Swatch id="royal" />
      </div>
    );
  }
  const v = THEMES[id].vars;
  return (
    <div className="swatch swatch-glass" style={{ background: v["--bg"], color: v["--ink"] }}>
      <div className="sw-photo" style={{ backgroundImage: v["--photo"], opacity: v["--photo-opacity"], filter: v["--photo-filter"] }} />
      <div className="sw-tint" style={{ background: `radial-gradient(70% 80% at 15% 10%, ${v["--orb-a"]}, transparent), ${v["--tint"]}` }} />
      <div className="sw-card" style={{ background: `linear-gradient(145deg, ${v["--glass-1"]}, ${v["--glass-2"]})`, borderColor: v["--glass-border"] }}>
        <span className="sw-clock">7:42</span>
        <span className="sw-row" style={{ background: `linear-gradient(135deg, ${v["--acc-1"]}, ${v["--acc-2"]})`, color: v["--acc-ink"] }}>Mincha <b>5:45</b></span>
      </div>
    </div>
  );
}

function Theme({ s, set }) {
  return (
    <>
      <Card title="Theme" subtitle="Changes reach the TV within a few seconds." icon={Palette}>
        <div className="themes">
          {THEME_OPTIONS.map((t) => (
            <button key={t.id} className={`theme-card ${s.theme === t.id ? "on" : ""}`} onClick={() => set({ theme: t.id })}>
              <Swatch id={t.id} />
              <span className="theme-name">{t.name}{s.theme === t.id && <Check size={16} />}</span>
              <span className="theme-blurb">{t.blurb}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Shabbat & Yom Tov" icon={Moon}>
        <Field label="From candle lighting to havdalah, switch to">
          <select className="input" value={s.shabbatTheme || ""} onChange={(e) => set({ shabbatTheme: e.target.value })}>
            <option value="">Keep the same theme</option>
            {Object.entries(THEMES).map(([id, t]) => <option key={id} value={id}>{t.name}</option>)}
          </select>
        </Field>
        <div className="toggle-list">
          <Toggle label="Pause flyers and slides on Shabbat" hint="Only the times show during Shabbat and Yom Tov" checked={s.pauseOnShabbat} onChange={(v) => set({ pauseOnShabbat: v })} />
        </div>
      </Card>
    </>
  );
}

const ELEMENTS = [
  ["showBsd", "בס״ד in the corner"],
  ["showCivilDate", "English date"],
  ["showHebrewDate", "Hebrew date"],
  ["showParasha", "Parasha / holiday name"],
  ["showGreeting", "Shabbat & holiday greeting"],
  ["showNextCard", "Next minyan countdown"],
  ["showZmanim", "Zmanim sun path"],
];
const BAR = [
  ["showCandleBar", "Candle lighting Thu–Fri, havdalah on Shabbat"],
  ["showTicker", "Announcements"],
  ["showLevana", "Birkat HaLevana (Sephardic times)"],
  ["showLimudim", "Daf Yomi (always on)"],
  ["showMakam", "Makam of the week"],
  ["showDonate", "Donation details"],
];

function Layout({ s, set }) {
  const zmanimList = window.__TV_ZMANIM__?.zmanimList || [];
  const hidden = s.hiddenZmanim || [];
  return (
    <>
      <Card title="Schedule screen" subtitle="Turn parts of the main screen on or off." icon={LayoutTemplate}>
        <div className="element-map">
          {ELEMENTS.map(([k, label]) => (
            <Toggle key={k} label={label} checked={s[k] !== false} onChange={(v) => set({ [k]: v })} />
          ))}
        </div>
      </Card>
      {s.showZmanim !== false && zmanimList.length > 0 && (
        <Card title="Zmanim on the sun path" subtitle="Tap to hide or show. Up to ten fit nicely." icon={Sun}>
          <div className="chip-pick">
            {zmanimList.map((zm) => {
              const on = !hidden.includes(zm.id);
              return <button key={zm.id} className={on ? "on" : ""} onClick={() => set({ hiddenZmanim: on ? [...hidden, zm.id] : hidden.filter((x) => x !== zm.id), zmanimV2: true })}>{zm.label}</button>;
            })}
          </div>
        </Card>
      )}
      <Card title="Bottom bar" subtitle="One message at a time along the bottom of the schedule screen." icon={Type}>
        <div className="element-map">
          {BAR.map(([k, label]) => <Toggle key={k} label={label} checked={s[k] !== false} onChange={(v) => set({ [k]: v })} />)}
        </div>
        <Field label="Speed">
          <Segmented value={s.tickerSpeed} onChange={(v) => set({ tickerSpeed: v })} options={[{ value: 90, label: "Slow" }, { value: 60, label: "Medium" }, { value: 40, label: "Fast" }]} />
        </Field>
      </Card>
      <Card title="When the Shabbat schedule appears" icon={Clock}>
        <Segmented value={Number(s.shabbatShowFrom ?? 4)} onChange={(v) => set({ shabbatShowFrom: v })}
          options={[{ value: 3, label: "Wednesday" }, { value: 4, label: "Thursday" }, { value: 5, label: "Friday" }, { value: 0, label: "All week" }]} />
        <p className="hint">Yom Tov schedules always appear two days ahead.</p>
      </Card>
    </>
  );
}

function Rotation({ s, set }) {
  return (
    <>
      <Card title="What rotates" icon={Repeat}>
        <div className="element-map">
          <Toggle label="Flyers" checked={s.showFlyers !== false} onChange={(v) => set({ showFlyers: v })} />
          <Toggle label="Slides (announcements, Mazal Tov, sponsors)" checked={s.showSlides !== false} onChange={(v) => set({ showSlides: v })} />
          <Toggle label="Community collage" checked={s.showCommunity !== false} onChange={(v) => set({ showCommunity: v })} />
          <Toggle label="Donation slide" checked={s.showDonateSlide !== false} onChange={(v) => set({ showDonateSlide: v })} />
          <Toggle label="Pair vertical flyers side by side" checked={s.pairVerticalFlyers} onChange={(v) => set({ pairVerticalFlyers: v })} />
        </div>
      </Card>
      <Card title="Order" subtitle="The TV repeats this loop. Anything that's off or empty is skipped.">
        <ol className="loop-order">
          <li>Times</li><li>Next minyan</li><li>A flyer or announcement, a different one each loop</li><li>Donate</li>
          <li>Times</li><li>Next minyan</li><li>Leaderboard</li><li>Free lunches</li>
        </ol>
      </Card>
      <Card title="Timing">
        <div className="grid-2">
          <Field label="Times screen"><Stepper value={s.scheduleSeconds} min={10} max={300} step={5} suffix="sec" onChange={(v) => set({ scheduleSeconds: v })} /></Field>
          <Field label="Next minyan"><Stepper value={s.minyanSeconds || 18} min={5} max={120} suffix="sec" onChange={(v) => set({ minyanSeconds: v })} /></Field>
          <Field label="Leaderboard and lunches"><Stepper value={s.leaderboardSeconds || 16} min={5} max={120} suffix="sec" onChange={(v) => set({ leaderboardSeconds: v })} /></Field>
          <Field label="Each flyer"><Stepper value={s.flyerSeconds} min={5} max={120} suffix="sec" onChange={(v) => set({ flyerSeconds: v })} /></Field>
          <Field label="Each slide" hint="Announcements and Donate"><Stepper value={s.announcementSeconds} min={5} max={120} suffix="sec" onChange={(v) => set({ announcementSeconds: v })} /></Field>
          <Field label="Community collage"><Stepper value={s.communitySeconds || 16} min={8} max={60} step={2} suffix="sec" onChange={(v) => set({ communitySeconds: v })} /></Field>
        </div>
        <Field label="Stay on the times before a minyan" hint="Slides pause this many minutes before each minyan.">
          <Segmented value={Number(s.holdBeforeMinyan) || 0} onChange={(v) => set({ holdBeforeMinyan: v })}
            options={[{ value: 0, label: "Off" }, { value: 5, label: "5 min" }, { value: 10, label: "10 min" }, { value: 15, label: "15 min" }, { value: 30, label: "30 min" }]} />
        </Field>
      </Card>
      <Card title="Style">
        <div className="grid-2">
          <Field label="Transition">
            <Segmented value={s.transition || "fade"} onChange={(v) => set({ transition: v })} options={[{ value: "fade", label: "Fade" }, { value: "slide", label: "Slide" }, { value: "zoom", label: "Zoom" }, { value: "cut", label: "Cut" }]} />
          </Field>
        </div>
      </Card>
    </>
  );
}

function HebrewFonts({ value, onChange }) {
  HEBREW_FONTS.forEach((f) => useHebrewFont(f.id));
  useHebrewFont(value);
  return (
    <div className="font-pick">
      {HEBREW_FONTS.map((f) => (
        <button key={f.id} className={value === f.id ? "on" : ""} onClick={() => onChange(f.id)}>
          <span className="font-sample" dir="rtl" style={{ fontFamily: `"${f.id}"` }}>י״ד חשון · מזל טוב</span>
          <span className="font-name">{f.id}{value === f.id && <Check size={15} />}</span>
        </button>
      ))}
    </div>
  );
}

// Read the QR code out of a photo of the printed Zelle sheet. The TV then draws
// a sharp copy of the same code instead of showing the photo.
async function readQr(file) {
  const bmp = await decodeImage(file);
  for (const max of [1600, 1000, 2400]) {
    const k = Math.min(1, max / Math.max(bmp.naturalWidth || bmp.width, bmp.naturalHeight || bmp.height));
    const c = document.createElement("canvas");
    const bw = bmp.naturalWidth || bmp.width, bh = bmp.naturalHeight || bmp.height;
    c.width = Math.round(bw * k);
    c.height = Math.round(bh * k);
    const ctx = c.getContext("2d");
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const code = jsQR(img.data, c.width, c.height, { inversionAttempts: "attemptBoth" });
    if (code?.data) return code.data;
  }
  return null;
}

function ZelleQr({ value, onChange }) {
  const input = React.useRef(null);
  const [msg, setMsg] = useState("");
  async function pick(file) {
    if (!file) return;
    setMsg("Reading…");
    try {
      const data = await readQr(file);
      if (!data) return setMsg("Couldn't find a QR code in that photo. Try a closer, straight-on photo.");
      onChange(data);
      setMsg("Zelle QR code saved. It now shows on the donation slide.");
    } catch (e) {
      setMsg("Couldn't read that image.");
    }
  }
  return (
    <Field label="Zelle QR code" hint="Upload a photo or screenshot of your bank's Zelle QR code.">
      <div className="row-actions">
        <button type="button" className="btn btn-secondary" onClick={() => input.current.click()}><QrCode size={17} /><span>{value ? "Replace QR code" : "Upload QR code"}</span></button>
        {value && <button type="button" className="btn btn-ghost-danger" onClick={() => { onChange(""); setMsg(""); }}><Trash2 size={16} /><span>Remove</span></button>}
        <input ref={input} type="file" accept={IMAGE_ACCEPT} hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ""; }} />
      </div>
      {value && !msg && <span className="hint">A Zelle QR code is saved.</span>}
      {msg && <span className="hint">{msg}</span>}
    </Field>
  );
}

function ClockText({ s, set }) {
  const [text, setText] = useDraft({ shulName: s.shulName, shulNameHe: s.shulNameHe, donate: s.donate }, (v) => patchTv("settings", v));
  return (
    <>
      <Card title="Clock" icon={Clock}>
        <div className="grid-2">
          <Field label="Format"><Segmented value={s.clock24 ? "24" : "12"} onChange={(v) => set({ clock24: v === "24" })} options={[{ value: "12", label: "6:30 PM" }, { value: "24", label: "18:30" }]} /></Field>
          <Field label="Seconds"><Segmented value={s.showSeconds ? "on" : "off"} onChange={(v) => set({ showSeconds: v === "on" })} options={[{ value: "off", label: "Hide" }, { value: "on", label: "Show" }]} /></Field>
        </div>
      </Card>
      <Card title="Hebrew font" subtitle="Used for the Hebrew date, parasha, names and מזל טוב." icon={Type}>
        <HebrewFonts value={s.hebrewFont || "Heebo"} onChange={(v) => set({ hebrewFont: v })} />
      </Card>
      <Card title="Names & donation details" icon={Type}>
        <div className="grid-2">
          <Field label="Name"><input className="input" value={text.shulName} onChange={(e) => setText({ ...text, shulName: e.target.value })} /></Field>
          <Field label="Hebrew name"><input className="input" dir="rtl" value={text.shulNameHe} onChange={(e) => setText({ ...text, shulNameHe: e.target.value })} /></Field>
          <Field label="Venmo"><input className="input" value={text.donate.venmo} onChange={(e) => setText({ ...text, donate: { ...text.donate, venmo: e.target.value } })} /></Field>
          <Field label="Zelle"><input className="input" value={text.donate.zelle} onChange={(e) => setText({ ...text, donate: { ...text.donate, zelle: e.target.value } })} /></Field>
          <Field label="Website"><input className="input" value={text.donate.website} onChange={(e) => setText({ ...text, donate: { ...text.donate, website: e.target.value } })} /></Field>
          <ZelleQr value={text.donate.zelleQr || ""} onChange={(v) => setText({ ...text, donate: { ...text.donate, zelleQr: v } })} />
        </div>
      </Card>
    </>
  );
}

export default function Screen({ tv }) {
  const [tab, setTab] = useState("layout");
  const s = tv.settings;
  const set = (patch) => patchTv("settings", patch);
  return (
    <div className="stack">
      <Tabs value={tab} onChange={setTab} options={[
        { value: "layout", label: "Layout", icon: LayoutTemplate },
        { value: "rotation", label: "Rotation", icon: Repeat },
        { value: "clock", label: "Clock & text", icon: Type },
      ]} />
      {tab === "layout" && <Layout s={s} set={set} />}
      {tab === "rotation" && <Rotation s={s} set={set} />}
      {tab === "clock" && <ClockText s={s} set={set} />}
    </div>
  );
}
