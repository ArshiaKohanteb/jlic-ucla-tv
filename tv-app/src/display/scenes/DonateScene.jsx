import React, { useMemo } from "react";
import qrcode from "qrcode-generator";
import { Ornament } from "./common.jsx";

// A crisp QR code as an SVG path (white modules on a rounded white tile).
function QR({ value }) {
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
    <svg className="qr" viewBox={`-2 -2 ${n + 4} ${n + 4}`} aria-hidden="true" shapeRendering="crispEdges">
      <rect x="-2" y="-2" width={n + 4} height={n + 4} rx="2" fill="#fff" />
      <path d={d} fill="#0A1A3A" />
    </svg>
  );
}

// Let long emails wrap at the @ rather than mid-word.
const breakAtAt = (v) => {
  const i = v.indexOf("@");
  return i > 0 ? <>{v.slice(0, i)}<wbr />{v.slice(i)}</> : v;
};
// Brand marks (Simple Icons, CC0) so people recognise each way to give.
const VENMO_PATH = "M21.772 13.119c-.267 0-.381-.251-.38-.655 0-.533.121-1.575.712-1.575.267 0 .357.243.357.598 0 .533-.13 1.632-.689 1.632Zm.502-3.377c-1.677 0-2.405 1.285-2.405 2.658 0 1.042.421 1.874 1.693 1.874 1.717 0 2.438-1.406 2.438-2.763 0-1.025-.462-1.769-1.726-1.769Zm-3.833 0c-.558 0-.964.17-1.393.477-.154-.275-.462-.477-.932-.477-.542 0-.947.219-1.247.437l-.04-.364H13.54l-.688 4.354h1.506l.479-3.053c.129-.065.323-.154.518-.154.145 0 .267.049.267.267 0 .056-.016.145-.024.218l-.429 2.722h1.498l.478-3.053c.138-.073.324-.154.51-.154.146 0 .268.049.268.267 0 .056-.017.145-.025.218l-.429 2.722h1.499l.461-2.908c.025-.153.049-.388.049-.549 0-.582-.267-.97-1.037-.97Zm-6.871 0c-.575 0-.98.219-1.287.421l-.017-.348H8.962l-.689 4.354H9.78l.478-3.053c.13-.065.324-.154.518-.154.147 0 .268.049.268.242 0 .081-.024.227-.032.299l-.422 2.666h1.499l.462-2.908c.024-.153.049-.388.049-.549 0-.582-.268-.97-1.03-.97Zm-5.631 1.834c.041-.485.413-.824.697-.824.162 0 .299.097.299.291 0 .404-.713.533-.996.533Zm.843-1.834c-1.604 0-2.382 1.39-2.382 2.698 0 1.01.478 1.817 1.814 1.817.527 0 1.07-.113 1.418-.282l.186-1.26c-.494.25-.874.347-1.271.347-.365 0-.64-.194-.64-.687.826-.008 2.252-.347 2.252-1.453 0-.687-.494-1.18-1.377-1.18Zm-4.239.267c.089.186.146.412.146.743 0 .606-.429 1.494-.777 2.06l-.373-2.989L0 9.969l.705 4.2h1.757c.77-1.01 1.718-2.448 1.718-3.554 0-.347-.073-.622-.235-.889l-1.402.283Z";
const ZELLE_PATH = "M13.559 24h-2.841a.483.483 0 0 1-.483-.483v-2.765H5.638a.667.667 0 0 1-.666-.666v-2.234a.67.67 0 0 1 .142-.412l8.139-10.382h-7.25a.667.667 0 0 1-.667-.667V3.914c0-.367.299-.666.666-.666h4.23V.483c0-.266.217-.483.483-.483h2.841c.266 0 .483.217.483.483v2.765h4.323c.367 0 .666.299.666.666v2.137a.67.67 0 0 1-.141.41l-8.19 10.481h7.665c.367 0 .666.299.666.666v2.477a.667.667 0 0 1-.666.667h-4.32v2.765a.483.483 0 0 1-.483.483Z";

function Logo({ kind }) {
  if (kind === "venmo") {
    return <div className="logo logo-venmo"><svg viewBox="0 0 24 24" aria-label="Venmo"><path d={VENMO_PATH} /></svg></div>;
  }
  if (kind === "zelle") {
    return <div className="logo logo-zelle"><svg viewBox="0 0 24 24" aria-label="Zelle"><path d={ZELLE_PATH} /></svg><span>Zelle</span></div>;
  }
  return <div className="logo logo-web"><span>Website</span></div>;
}

const venmoUser = (h) => String(h || "").replace(/^@/, "").trim();
const site = (w) => String(w || "").replace(/^https?:\/\//, "").replace(/\/$/, "");

export default function DonateScene({ tv, sched }) {
  const d = tv.settings.donate || {};
  const shabbat = sched?.inPeriod;
  const methods = [
    d.venmo && { key: "venmo", label: "Venmo", value: d.venmo.startsWith("@") ? d.venmo : "@" + d.venmo, qr: `https://venmo.com/u/${venmoUser(d.venmo)}` },
    d.zelle && { key: "zelle", label: "Zelle", value: d.zelle, qr: d.zelleQr || null, hint: d.zelleQr ? "Scan in your banking app" : "Send from your bank app" },
    d.website && { key: "web", label: "Online", value: site(d.website), qr: `https://${site(d.website)}` },
  ].filter(Boolean);

  return (
    <div className="scene scene-donate">
      <div className="donate-card glass">
        <Ornament className="rise" />
        <h1 className="donate-title rise" style={{ animationDelay: ".1s" }}>Support {tv.settings.shulName}</h1>
        <p className="donate-sub rise" style={{ animationDelay: ".25s" }}>
          {shabbat ? "Please remember us after Shabbat" : "Your generosity keeps our minyanim, kiddush and programs going"}
        </p>
        <div className={`donate-methods ${shabbat ? "no-qr" : ""}`}>
          {methods.map((m, i) => (
            <div key={m.key} className="donate-method rise" style={{ animationDelay: `${0.4 + i * 0.15}s` }}>
              <Logo kind={m.key} />
              {!shabbat && (m.qr ? <QR value={m.qr} /> : <div className="qr qr-blank"><svg viewBox="0 0 24 24"><path d={ZELLE_PATH} /></svg></div>)}
              <span className="donate-value">{breakAtAt(m.value)}</span>
              {!shabbat && <span className="donate-hint">{m.hint || "Scan with your phone camera"}</span>}
            </div>
          ))}
        </div>
        {d.website && (
          <p className="donate-foot rise" style={{ animationDelay: ".9s" }}>
            {shabbat ? "After Shabbat, everything is at " : "Everything is also at "}<b>{site(d.website)}</b>
          </p>
        )}
      </div>
    </div>
  );
}
