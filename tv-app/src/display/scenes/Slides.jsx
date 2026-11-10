import React from "react";
import { Logos, QR, Time } from "./parts.jsx";
import { ShabbatList } from "./Board.jsx";
import { OCCASIONS, DEDICATIONS } from "../../shared/defaults.js";
import { whenWords } from "../../shared/minyan.js";

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
export const venmoUser = (h) => String(h || "").replace(/^@/, "").trim();

// Brand marks (Simple Icons, CC0) so people recognise each way to give.
const VENMO_PATH = "M21.772 13.119c-.267 0-.381-.251-.38-.655 0-.533.121-1.575.712-1.575.267 0 .357.243.357.598 0 .533-.13 1.632-.689 1.632Zm.502-3.377c-1.677 0-2.405 1.285-2.405 2.658 0 1.042.421 1.874 1.693 1.874 1.717 0 2.438-1.406 2.438-2.763 0-1.025-.462-1.769-1.726-1.769Zm-3.833 0c-.558 0-.964.17-1.393.477-.154-.275-.462-.477-.932-.477-.542 0-.947.219-1.247.437l-.04-.364H13.54l-.688 4.354h1.506l.479-3.053c.129-.065.323-.154.518-.154.145 0 .267.049.267.267 0 .056-.016.145-.024.218l-.429 2.722h1.498l.478-3.053c.138-.073.324-.154.51-.154.146 0 .268.049.268.267 0 .056-.017.145-.025.218l-.429 2.722h1.499l.461-2.908c.025-.153.049-.388.049-.549 0-.582-.267-.97-1.037-.97Zm-6.871 0c-.575 0-.98.219-1.287.421l-.017-.348H8.962l-.689 4.354H9.78l.478-3.053c.13-.065.324-.154.518-.154.147 0 .268.049.268.242 0 .081-.024.227-.032.299l-.422 2.666h1.499l.462-2.908c.024-.153.049-.388.049-.549 0-.582-.268-.97-1.03-.97Zm-5.631 1.834c.041-.485.413-.824.697-.824.162 0 .299.097.299.291 0 .404-.713.533-.996.533Zm.843-1.834c-1.604 0-2.382 1.39-2.382 2.698 0 1.01.478 1.817 1.814 1.817.527 0 1.07-.113 1.418-.282l.186-1.26c-.494.25-.874.347-1.271.347-.365 0-.64-.194-.64-.687.826-.008 2.252-.347 2.252-1.453 0-.687-.494-1.18-1.377-1.18Zm-4.239.267c.089.186.146.412.146.743 0 .606-.429 1.494-.777 2.06l-.373-2.989L0 9.969l.705 4.2h1.757c.77-1.01 1.718-2.448 1.718-3.554 0-.347-.073-.622-.235-.889l-1.402.283Z";
const ZELLE_PATH = "M13.559 24h-2.841a.483.483 0 0 1-.483-.483v-2.765H5.638a.667.667 0 0 1-.666-.666v-2.234a.67.67 0 0 1 .142-.412l8.139-10.382h-7.25a.667.667 0 0 1-.667-.667V3.914c0-.367.299-.666.666-.666h4.23V.483c0-.266.217-.483.483-.483h2.841c.266 0 .483.217.483.483v2.765h4.323c.367 0 .666.299.666.666v2.137a.67.67 0 0 1-.141.41l-8.19 10.481h7.665c.367 0 .666.299.666.666v2.477a.667.667 0 0 1-.666.667h-4.32v2.765a.483.483 0 0 1-.483.483Z";

export function PayLogo({ kind }) {
  if (kind === "Venmo") return <div className="pay pay-venmo"><svg viewBox="0 0 24 24" role="img" aria-label="Venmo"><path d={VENMO_PATH} /></svg></div>;
  if (kind === "Zelle") return <div className="pay pay-zelle"><svg viewBox="0 0 24 24" aria-hidden="true"><path d={ZELLE_PATH} /></svg><span>Zelle</span></div>;
  return <div className="pay pay-web"><span>Online</span></div>;
}

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
            <PayLogo kind={w.key} />
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
export function Bar({ next, tz, now, logos }) {
  const when = next ? whenWords(next, now) : null;
  return (
    <div className="bar">
      <div className="bar-next">
        {next && <><b dir="auto">{next.name}</b>{next.epoch != null && <Time epoch={next.epoch} tz={tz} />}<span className={when.soon ? "soon" : ""}>{when.text}</span></>}
      </div>
      {logos && <Logos />}
    </div>
  );
}
