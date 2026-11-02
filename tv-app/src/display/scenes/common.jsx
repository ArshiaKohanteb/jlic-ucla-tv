import React from "react";
import { useNow } from "../hooks.js";
import { formatEpoch, minutesUntil } from "../../shared/schedule.js";

// The logo lockup: the logo, which carries the name. Used once per screen.
export function Brand({ tv, small = false }) {
  return (
    <div className={`brand ${small ? "brand-sm" : ""}`}>
      <div className="logo-mark" aria-hidden="true" />
      {tv.settings.shulNameHe && <div className="brand-text"><span className="brand-he" dir="rtl">{tv.settings.shulNameHe}</span></div>}
    </div>
  );
}

export function Clock({ showSeconds, tz, className = "" }) {
  const now = useNow(1000);
  const f = formatEpoch(now, tz, showSeconds);
  const [h, ...rest] = f.time.split(":");
  return (
    <div className={`clock ${className}`}>
      <span className="clock-time">{h}<span className="clock-colon">:</span>{rest.join(":")}</span>
      <span className="clock-ampm">{f.ampm}</span>
    </div>
  );
}

export function Time({ epoch, tz }) {
  const f = formatEpoch(epoch, tz);
  return (
    <span className="t">
      {f.time}
      <small>{f.ampm}</small>
    </span>
  );
}

export function countdownText(epoch, now) {
  const m = minutesUntil(epoch, now);
  if (m <= 0) return "now";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `in ${h} hr ${r} min` : `in ${h} hr`;
}

// A thin gold rule with a diamond in the middle.
export function Ornament({ className = "" }) {
  return (
    <div className={`ornament ${className}`} aria-hidden="true">
      <span /><i /><span />
    </div>
  );
}
