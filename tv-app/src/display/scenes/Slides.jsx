import React from "react";
import { Logos, QR, Time } from "./parts.jsx";
import { ShabbatList } from "./Board.jsx";
import { OCCASIONS, DEDICATIONS } from "../../shared/defaults.js";

const size = (text, steps) => steps.find(([max]) => text.length <= max)?.[1] || steps[steps.length - 1][1];
const TITLE = [[20, "xl"], [42, "l"], [80, "m"], [9999, "s"]];

const Backdrop = ({ url }) => <div className="backdrop" style={{ backgroundImage: `url("${url}")` }} />;

export function FlyerSlide({ slide }) {
  const [a, b] = slide.items;
  return (
    <div className={`slide flyer flyer-${slide.layout}`}>
      <Backdrop url={a.url} />
      <div className="flyer-row">
        <img decoding="async" src={a.url} alt={a.name || ""} />
        {b && <img decoding="async" src={b.url} alt={b.name || ""} />}
      </div>
    </div>
  );
}

// One big photograph, or two portraits side by side, moving very slowly.
export function PhotoSlide({ slide }) {
  const photos = slide.pick?.photos || [];
  return (
    <div className={`slide photos photos-${photos.length}`}>
      {photos.map((p, i) => <div key={p.id} className="photo" style={{ backgroundImage: `url("${p.url}")`, animationDelay: `-${i * 3}s` }} />)}
    </div>
  );
}

export function pickPhotos(tv) {
  const library = (tv.photos || []).filter((p) => p.url && p.active !== false);
  const wide = library.filter((p) => !p.w || p.w / p.h >= 1.1);
  const tall = library.filter((p) => p.w && p.w / p.h < 1.1);
  const any = (l) => l[Math.floor(Math.random() * l.length)];
  if (tall.length >= 2 && (!wide.length || Math.random() < tall.length / library.length)) {
    const a = any(tall);
    return { photos: [a, any(tall.filter((p) => p.id !== a.id))] };
  }
  return { photos: wide.length ? [any(wide)] : [] };
}

function Announcement({ a, flyer }) {
  const title = a.title || "";
  return (
    <div className={`slide poster ${flyer ? "has-flyer" : ""} tone-${a.style || "info"}`}>
      {flyer && <Backdrop url={flyer.url} />}
      <div className="poster-text">
        {title && <h1 className={`p-title p-${size(title, TITLE)}`} dir="auto">{title}</h1>}
        {a.body && <p className={`p-body ${a.body.length > 140 ? "p-body-s" : ""}`} dir="auto">{a.body}</p>}
      </div>
      {flyer && <img className="poster-flyer" decoding="async" src={flyer.url} alt={flyer.name || ""} />}
    </div>
  );
}

function MazalTov({ a }) {
  const occ = OCCASIONS[a.occasion] || OCCASIONS.other;
  const line = a.line ?? occ.line;
  return (
    <div className="slide poster poster-center">
      <p className="mazal" dir="rtl">מזל טוב</p>
      {line && <p className="p-body">{line}</p>}
      {a.title && <h1 className={`p-title p-${size(a.title, TITLE)}`} dir="auto">{a.title}</h1>}
      {a.body && <p className="p-body" dir="auto">{a.body}</p>}
    </div>
  );
}

function Sponsor({ a }) {
  const ded = DEDICATIONS[a.dedication || "none"] ?? "";
  return (
    <div className="slide poster poster-center">
      <p className="p-body">This week's {a.meal || "Kiddush"} is sponsored by</p>
      {a.title && <h1 className={`p-title p-${size(a.title, TITLE)}`} dir="auto">{a.title}</h1>}
      {a.body && <p className="p-body" dir="auto">{ded ? `${ded} ` : ""}{a.body}</p>}
    </div>
  );
}

export function AnnouncementSlide({ slide }) {
  const a = slide.item;
  if (a.style === "celebration") return <MazalTov a={a} />;
  if (a.style === "sponsor") return <Sponsor a={a} />;
  return <Announcement a={a} flyer={slide.flyer} />;
}

const site = (w) => String(w || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
const venmoUser = (h) => String(h || "").replace(/^@/, "").trim();

export function DonateSlide({ tv, shabbat }) {
  const d = tv.settings.donate || {};
  const ways = [
    d.venmo && { key: "Venmo", value: d.venmo.startsWith("@") ? d.venmo : "@" + d.venmo, qr: `https://venmo.com/u/${venmoUser(d.venmo)}` },
    d.zelle && { key: "Zelle", value: d.zelle, qr: d.zelleQr || null },
    d.website && { key: "Online", value: site(d.website), qr: `https://${site(d.website)}` },
  ].filter(Boolean);
  return (
    <div className="slide poster">
      <h1 className="p-title p-l">Support {tv.settings.shulName}</h1>
      <div className="ways">
        {ways.map((w) => (
          <div key={w.key} className="way">
            {!shabbat && w.qr && <QR value={w.qr} label={`${w.key} code`} />}
            <b>{w.key}</b>
            <span>{w.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LogoSlide() {
  return <div className="slide logo-slide"><Logos /></div>;
}

export function ShabbatSlide({ sched, tz }) {
  return <div className="slide poster poster-shabbat"><ShabbatList sched={sched} tz={tz} /></div>;
}

// Stays along the bottom during every slide so the room always has what's next.
export function Bar({ next, tz, logos }) {
  return (
    <div className="bar">
      <div className="bar-next">
        {next && <><b dir="auto">{next.name}</b>{next.epoch != null && <Time epoch={next.epoch} tz={tz} />}<span>{next.day}</span></>}
      </div>
      {logos && <Logos />}
    </div>
  );
}
