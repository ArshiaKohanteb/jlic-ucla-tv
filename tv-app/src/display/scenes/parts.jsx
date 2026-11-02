import React, { useMemo } from "react";
import qrcode from "qrcode-generator";
import { formatEpoch } from "../../shared/schedule.js";
import { TEN, statusWords } from "../../shared/minyan.js";

export function Time({ epoch, tz }) {
  const f = formatEpoch(epoch, tz);
  return <span className="t">{f.time}<small>{f.ampm}</small></span>;
}

export function Logos() {
  return (
    <div className="logos">
      <div className="jlic" role="img" aria-label="JLIC UCLA"><span>UCLA</span></div>
      <img className="hillel" src={`${import.meta.env.BASE_URL}hillel.png`} alt="Hillel at UCLA" />
    </div>
  );
}

export function QR({ value, label }) {
  const { d, n } = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(value);
    q.make();
    const n = q.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`;
    return { d, n };
  }, [value]);
  return (
    <svg className="qr" viewBox={`-2 -2 ${n + 4} ${n + 4}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={n + 4} height={n + 4} fill="#F6F2E9" />
      <path d={d} fill="#0B0D1A" />
    </svg>
  );
}

// Who's coming, said quietly: ten small marks and a few words.
export function Count({ o }) {
  const words = statusWords(o);
  const lit = o.on ? TEN : o.count;
  return (
    <div className={`count ${o.on ? "is-on" : ""} ${o.off ? "is-off" : ""}`}>
      {!o.off && !o.on && <div className="marks" aria-hidden="true">{Array.from({ length: TEN }, (_, i) => <i key={i} className={i < lit ? "in" : ""} />)}</div>}
      <span>{o.on || o.off ? words.big : o.known ? `${o.count} of ${TEN}` : "Not confirmed"}</span>
    </div>
  );
}
