import React from "react";
import { Clock, Megaphone, Images, Camera, PauseCircle, Copy, ExternalLink } from "lucide-react";
import { Card, Toggle } from "../ui.jsx";
import { patchTv } from "../../shared/store.js";
import { buildSchedule, fmt, minutesUntil, localInfo } from "../../shared/schedule.js";
import { status } from "./Announcements.jsx";
import LivePreview from "./LivePreview.jsx";
import { can } from "../access.js";

const SCREENS = [
  { url: `${location.origin}${import.meta.env.BASE_URL}tv/`, label: "TV" },
  { url: `${location.origin}${import.meta.env.BASE_URL}tv/flipped/`, label: "Upside-down TV" },
  { url: `${location.origin}${import.meta.env.BASE_URL}`, label: "Sign-up site for everyone" },
];

const inTime = (m) => (m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}`);

function hello(name) {
  const h = localInfo(Date.now()).hour;
  const part = h < 12 ? "Boker tov" : h < 17 ? "Good afternoon" : "Erev tov";
  return name ? `${part}, ${name.split(" ")[0]}` : part;
}

export function ScreenLinks() {
  return (
    <div className="stack-sm">
      {SCREENS.map((s) => (
        <div className="url-row" key={s.url}>
          <div><code>{s.url.replace("https://", "")}</code><span>{s.label}</span></div>
          <button className="icon-btn" aria-label="Copy" title="Copy" onClick={() => navigator.clipboard?.writeText(s.url)}><Copy size={17} /></button>
          <a className="icon-btn" href={s.url} target="_blank" rel="noreferrer" aria-label="Open" title="Open"><ExternalLink size={17} /></a>
        </div>
      ))}
    </div>
  );
}

export default function Home({ tv, z, user, go }) {
  const now = Date.now();
  const sched = buildSchedule(tv, z, now);
  const live = (list) => list.filter((x) => status(x).cls === "badge-live").length;
  const today = sched.groups.flatMap((g) => g.items.map((m) => ({ ...m, group: g.title }))).sort((a, b) => a.epoch - b.epoch);
  const photos = (tv.photos || []).filter((p) => p.active !== false).length;

  return (
    <div className="stack">
      <section className="hero-card">
        <div>
          <div className="hero-hello">{hello(user.name)}</div>
          <div className="hero-date">{z?.hebrewDate?.civil}</div>
          {z?.hebrewDate?.hebrew && <div className="hero-heb" dir="rtl">{z.hebrewDate.hebrew}{z.parasha ? ` · פרשת ${z.parasha}` : ""}</div>}
        </div>
        <div className="hero-next">
          <span>{sched.next ? `Next · ${inTime(minutesUntil(sched.next.epoch))}` : "Nothing else today"}</span>
          <b>{sched.next ? sched.next.name : sched.period?.title || "—"}</b>
          {sched.next && <em>{fmt(sched.next.epoch)}</em>}
          {sched.greeting && <small>{sched.greeting.en}</small>}
        </div>
      </section>

      <div className="stat-row">
        <button className="stat" onClick={() => go("schedule")}><span className="stat-label"><Clock size={14} />Times today</span><b>{today.length}</b><span>on the board</span></button>
        <button className="stat" onClick={() => go("announcements")}><span className="stat-label"><Megaphone size={14} />Slides</span><b>{live(tv.announcements)}</b><span>showing now</span></button>
        <button className="stat" onClick={() => go("media")}><span className="stat-label"><Images size={14} />Flyers</span><b>{live(tv.flyers)}</b><span>showing now</span></button>
        <button className="stat" onClick={() => go("media")}><span className="stat-label"><Camera size={14} />Photos</span><b>{photos}</b><span>in the collage</span></button>
      </div>

      <div className="grid-2">
        <Card title="On the board" subtitle="What the TV is showing for today and what's coming up." icon={Clock}>
          {today.length ? (
            <ul className="today-list">
              {today.map((m) => (
                <li key={m.id + m.epoch} className={sched.next && m.epoch === sched.next.epoch && m.id === sched.next.id ? "next" : m.epoch < now ? "past" : ""}>
                  <span>{m.name}{m.note ? ` · ${m.note}` : ""}</span><b>{fmt(m.epoch)}</b>
                </li>
              ))}
            </ul>
          ) : <p className="empty-state">No times today. Add them under Times.</p>}
        </Card>
        <div className="stack">
          {can(user, "screen") && <Card title="Quick controls" icon={PauseCircle} className="hide-wide">
            <div className="toggle-list">
              <Toggle label="Times only" hint="Pause flyers, slides and the collage" checked={tv.settings.contentPaused} onChange={(v) => patchTv("settings", { contentPaused: v })} />
              <Toggle label="Pause slides on Shabbat" checked={tv.settings.pauseOnShabbat} onChange={(v) => patchTv("settings", { pauseOnShabbat: v })} />
            </div>
          </Card>}
          <Card title="Screen addresses" subtitle="Open one of these on the TV." icon={ExternalLink}>
            <ScreenLinks />
          </Card>
        </div>
      </div>

      <div className="mobile-preview"><LivePreview tv={tv} inline /></div>
    </div>
  );
}
