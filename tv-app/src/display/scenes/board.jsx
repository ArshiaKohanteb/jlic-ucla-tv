import React from "react";
import { Clock, Time } from "./common.jsx";
import { TEN, statusWords } from "../../shared/minyan.js";

// Ten circles, one for each person: the board's signature, and the dot of the JLIC "i".
export function TenDots({ count, small = false }) {
  return (
    <div className={`ten ${small ? "ten-sm" : ""}`} role="img" aria-label={`${count} of ${TEN}`}>
      {Array.from({ length: TEN }, (_, i) => <span key={i} className={i < count ? "in" : ""} />)}
    </div>
  );
}

function classFor(o) {
  return o.off ? "is-off" : o.on ? "is-on" : o.known ? "is-voting" : "is-unknown";
}

export function MinyanCard({ o, tz, solo }) {
  const words = statusWords(o);
  return (
    <section className={`mcard ${classFor(o)} ${solo ? "mcard-solo" : ""}`}>
      <div className="mcard-head">
        <span className="mcard-day">{o.day}</span>
        <h2 className="mcard-name" dir="auto">{o.name}</h2>
      </div>
      <div className="mcard-time">{o.epoch != null ? <Time epoch={o.epoch} tz={tz} /> : <span className="t">Time to come</span>}</div>
      <div className="mcard-where" dir="auto">{[o.place, o.note].filter(Boolean).join("  ·  ") || " "}</div>
      <div className="mcard-foot">
        <TenDots count={o.on ? TEN : o.count} />
        <div className="mcard-status" key={words.big}>{words.big}</div>
        <div className="mcard-sub">{words.small}</div>
      </div>
    </section>
  );
}

// Always on screen: the time, the date and the two logos.
export function Rail({ tv, z, sched, tz, next, showNext }) {
  const s = tv.settings;
  const parasha = s.showParasha === false ? "" : z?.parasha ? `פרשת ${z.parasha}` : sched?.holidayToday?.he || "";
  const words = next ? statusWords(next) : null;
  return (
    <aside className="rail">
      <div className="rail-top">
        <Clock showSeconds={s.showSeconds} tz={tz} className="rail-clock" />
        {s.showCivilDate !== false && <div className="rail-date">{z?.hebrewDate?.civil || ""}</div>}
        {s.showHebrewDate !== false && z?.hebrewDate?.hebrew && <div className="rail-heb" dir="rtl">{z.hebrewDate.hebrew}</div>}
        {parasha && <div className="rail-heb" dir="rtl">{parasha}</div>}
      </div>
      {showNext && next && (
        <div className={`rail-next ${classFor(next)}`}>
          <div className="rail-next-name" dir="auto">{next.name}</div>
          <div className="rail-next-time">{next.day}{next.epoch != null && <> · <Time epoch={next.epoch} tz={tz} /></>}</div>
          <TenDots count={next.on ? TEN : next.count} small />
          <div className="rail-next-status">{words.big}</div>
        </div>
      )}
      <div className="rail-logos">
        <div className="logo-mark" role="img" aria-label="JLIC UCLA" />
        <img className="hillel-mark" src={`${import.meta.env.BASE_URL}hillel.png`} alt="Hillel at UCLA" />
      </div>
    </aside>
  );
}
