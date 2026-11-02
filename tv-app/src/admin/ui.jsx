import React, { useEffect, useRef, useState } from "react";
import { X, Minus, Plus, PenLine } from "lucide-react";
import { DAY_LABELS } from "../shared/defaults.js";
import { ZMAN_CHOICES, describeTime, resolveTime, fmt, localInfo } from "../shared/schedule.js";

export function Card({ title, subtitle, action, icon: Icon, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <div className="card-title">
            {Icon && <span className="card-icon"><Icon size={19} strokeWidth={2.2} /></span>}
            <div>
              {title && <h3>{title}</h3>}
              {subtitle && <p className="sub">{subtitle}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Button({ variant = "secondary", icon: Icon, children, className = "", ...rest }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...rest}>
      {Icon && <Icon size={18} strokeWidth={2.2} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="toggle-row">
      <span>
        <span className="toggle-label">{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </span>
      <button type="button" role="switch" aria-checked={!!checked} className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
        <span />
      </button>
    </label>
  );
}

export function Segmented({ value, options, onChange, small }) {
  return (
    <div className={`seg ${small ? "seg-sm" : ""}`} role="radiogroup">
      {options.map((o) => (
        <button type="button" key={o.value} role="radio" aria-checked={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix }) {
  const v = Number(value) || 0;
  return (
    <div className="stepper">
      <button type="button" aria-label="Less" onClick={() => onChange(Math.max(min, v - step))}><Minus size={16} /></button>
      <span>{v}{suffix && <small> {suffix}</small>}</span>
      <button type="button" aria-label="More" onClick={() => onChange(Math.min(max, v + step))}><Plus size={16} /></button>
    </div>
  );
}

export function DaysPicker({ value = [], onChange }) {
  const toggle = (d) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <div className="days">
      {DAY_LABELS.map((l, d) => (
        <button type="button" key={d} className={value.includes(d) ? "on" : ""} onClick={() => toggle(d)}>{l.slice(0, 2)}</button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.classList.add("modal-open");
    return () => { window.removeEventListener("keydown", k); document.body.classList.remove("modal-open"); };
  }, []);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <header className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

// Edit a schedule time: a fixed clock time, or minutes before/after a zman.
export function TimeEditor({ value, onChange, allowShabbat, z, dateKey }) {
  const v = value || { type: "fixed", value: "" };
  const set = (patch) => onChange({ ...v, ...patch });
  const preview = z && dateKey ? resolveTime(v, dateKey, z) : null;
  const off = Number(v.offset) || 0;
  return (
    <div className="time-editor">
      <Segmented
        small
        value={v.type}
        onChange={(type) => onChange(type === "fixed" ? { type, value: v.value || "" } : { type, zman: v.zman || "sunset", offset: v.offset ?? -15, round: v.round ?? 5 })}
        options={[{ value: "fixed", label: "Set time" }, { value: "zman", label: "Based on zman" }]}
      />
      {v.type === "fixed" ? (
        <input type="time" className="input" value={v.value || ""} onChange={(e) => set({ value: e.target.value })} />
      ) : (
        <div className="zman-row">
          <Stepper value={Math.abs(off)} step={5} max={180} suffix="min" onChange={(n) => set({ offset: off < 0 ? -n : n })} />
          <select className="input" value={off < 0 ? "before" : "after"} onChange={(e) => set({ offset: e.target.value === "before" ? -Math.abs(off) : Math.abs(off) })}>
            <option value="before">before</option>
            <option value="after">after</option>
          </select>
          <select className="input" value={v.zman} onChange={(e) => set({ zman: e.target.value })}>
            {ZMAN_CHOICES.filter((c) => allowShabbat || !c.shabbat).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select className="input" value={v.round || 0} onChange={(e) => set({ round: Number(e.target.value) })}>
            <option value={0}>Exact minute</option>
            <option value={5}>Round down to 5 min</option>
            <option value={10}>Round down to 10 min</option>
          </select>
        </div>
      )}
      {v.type === "zman" && (
        <span className="hint">{describeTime(v)}{preview ? ` → ${fmt(preview)} this week` : ""}</span>
      )}
    </div>
  );
}

// Keeps a local copy while typing and saves after a short pause, so the
// live Firebase echo never fights the cursor.
export function useDraft(remote, save, delay = 600) {
  const [draft, setDraft] = useState(remote);
  const timer = useRef(null);
  const pending = useRef(false);
  const latest = useRef(remote);
  useEffect(() => { if (!pending.current) { setDraft(remote); latest.current = remote; } }, [JSON.stringify(remote)]);
  const update = (next) => {
    const val = typeof next === "function" ? next(draft) : next;
    setDraft(val);
    latest.current = val;
    pending.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try { await save(clean(val)); } finally { pending.current = false; }
    }, delay);
  };
  useEffect(() => () => {
    if (pending.current) { clearTimeout(timer.current); save(clean(latest.current)); }
  }, []);
  return [draft, update];
}

export const clean = (v) => JSON.parse(JSON.stringify(v ?? null));

export const todayKey = () => localInfo(Date.now()).dateKey;

export function Tabs({ value, onChange, options }) {
  return (
    <div className="tabs" role="tablist">
      {options.filter(Boolean).map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.icon && <o.icon size={16} />}{o.label}
        </button>
      ))}
    </div>
  );
}

// "5 min ago", "yesterday", "Mar 3"
export function ago(at) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Who last changed something. Takes an item ({ editedBy, editedAt }) or a log entry ({ by, at }).
export function EditedBy({ item, prefix = "Edited", className = "" }) {
  const by = item?.editedBy || item?.by;
  const at = item?.editedAt || item?.at;
  if (!by) return null;
  return (
    <span className={`edited-by ${className}`} title={at ? new Date(at).toLocaleString() : ""}>
      <PenLine size={12} />{prefix} by <b>{by.split(/[ @]/)[0]}</b>{at ? ` · ${ago(at)}` : ""}
    </span>
  );
}
