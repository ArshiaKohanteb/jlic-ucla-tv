import React from "react";
import { QR, Time } from "./parts.jsx";
import { PayLogo, venmoUser } from "./Slides.jsx";
import { TEN, closeWords } from "../../shared/minyan.js";
import { formatHHMM } from "../../shared/schedule.js";
import { shortName, leaders, lunchesWaiting, PER_LUNCH } from "../../shared/lunches.js";

const SITE = "uclaminyan.com";
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });
const counted = (people) => people.filter((p) => p.counts !== false).length;

// "Tomorrow · Tuesday", or just "Thursday" further out.
function dayLine(o) {
  const wd = WEEKDAY.format(new Date(o.date + "T12:00:00Z"));
  return o.day === wd ? wd : `${o.day} · ${wd}`;
}

// The time as two parts, so the AM/PM can be set smaller.
function TimeText({ hhmm }) {
  const [t, ampm] = formatHHMM(hhmm).split(" ");
  return <span className="t">{t}{ampm && <small>{ampm}</small>}</span>;
}

// ── 1. The poll: one column of ten seats per time, filling up as people vote ──

function Seats({ people }) {
  const names = people.map((p) => shortName(p.name));
  const shown = names.length > TEN ? [...names.slice(0, TEN - 1), `+${names.length - TEN + 1} more`] : names;
  return (
    <div className="mp-seats">
      {Array.from({ length: TEN }, (_, i) => (
        i < shown.length
          ? <div key={i} className="mp-seat in">{shown[i]}</div>
          : <div key={i} className={`mp-seat ${i === TEN - 1 ? "ten" : ""}`}>{i === TEN - 1 ? "10" : ""}</div>
      ))}
    </div>
  );
}

function Poll({ o, tv, now }) {
  const cols = o.votes?.length ? o.votes : [{ t: o.planned || o.locked || "", people: o.going, count: counted(o.going) }];
  const lead = Math.max(...cols.map((c) => c.count));
  const leader = lead > 0 ? cols.find((c) => c.count === lead) : null;
  const need = leader ? TEN - leader.count : TEN;
  const invite = tv.settings.waInvite;
  const close = closeWords(o, now);
  return (
    <div className="slide mp">
      <div className="mp-left">
        <p className="mx-eyebrow">{dayLine(o)}</p>
        <h1 className="mp-title" dir="auto">{o.name}</h1>
        <p className="mp-rule">{cols.length > 1 ? <>The first time to reach <b>10</b> is the minyan.</> : <>We need <b>10</b> to make it happen.</>}</p>
        <p className="mp-need"><i />{leader ? `${cols.length > 1 ? formatHHMM(leader.t) : "We"} ${cols.length > 1 ? "needs" : "need"} ${need} more` : "Be the first to vote"}</p>
        {close && <p className="mp-close">Poll {close.toLowerCase()}</p>}
        <div className="mx-card mp-join">
          <QR value={invite || `https://${SITE}/vote`} label={invite ? "Join the WhatsApp group" : `Vote at ${SITE}/vote`} />
          {invite ? <p><b>Vote in WhatsApp</b>Scan to join the minyan chat and cast your vote</p> : <p><b>Cast your vote</b>{SITE}/vote</p>}
        </div>
      </div>
      <div className="mp-cols" style={{ gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`, maxWidth: cols.length < 3 ? cols.length * 380 : undefined }}>
        {cols.map((c) => (
          <div key={c.t || "one"} className={`mx-card mp-col ${leader && c.t === leader.t ? "lead" : ""}`}>
            {c.t ? <TimeText hhmm={c.t} /> : <span className="t">Time to come</span>}
            <p className="mp-n">{c.count} of {TEN}{leader && c.t === leader.t && cols.length > 1 ? " · leading" : ""}</p>
            <Seats people={c.people} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 2. A time reached ten: the minyan is on, and who's coming ──

const MAX_NAMES = 14;

function Venmo({ tv, shabbat }) {
  const handle = tv.settings.donate?.venmo;
  if (!handle || tv.settings.showDonate === false) return null;
  const user = venmoUser(handle);
  return (
    <div className="mx-card mo-give">
      {!shabbat && <QR value={`https://venmo.com/u/${user}`} label="Venmo code" />}
      <div>
        <PayLogo kind="Venmo" />
        <p><b>Support the minyan</b>Scan to donate on Venmo · @{user}</p>
      </div>
    </div>
  );
}

function On({ o, tv, tz, shabbat }) {
  const names = o.going.map((p) => shortName(p.name));
  const total = counted(o.going) + (o.extra || 0);
  const shown = names.length > MAX_NAMES ? names.slice(0, MAX_NAMES - 1) : names;
  const more = names.length - shown.length + (o.extra || 0);
  return (
    <div className="slide mo">
      <div className="mo-left">
        <span className="mo-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          {o.started ? "Davening now" : "We have a minyan"}
        </span>
        <p className="mo-name" dir="auto">{o.name} · {o.day}</p>
        {o.epoch != null ? <p className="mo-time"><Time epoch={o.epoch} tz={tz} /></p> : <p className="mo-time">Time to come</p>}
        <div className="mo-ten" aria-hidden="true">{Array.from({ length: Math.max(TEN, Math.min(total, 16)) }, (_, i) => <i key={i} className={i >= TEN ? "x" : ""} />)}</div>
        <p className="mo-meta"><span><b>{total}</b> coming</span>{o.place && <span dir="auto">{o.place}</span>}</p>
      </div>
      <div className="mo-right">
        <div className="mx-card mo-who">
          <h3>Who's coming <span>from the WhatsApp poll</span></h3>
          <ul>
            {shown.map((n, i) => <li key={i}>{n}</li>)}
            {more > 0 && <li className="mo-more">+{more} more</li>}
          </ul>
          <p className="mo-foot">Can't make it? Change your vote in the chat.</p>
        </div>
        <Venmo tv={tv} shabbat={shabbat} />
      </div>
    </div>
  );
}

// For the showcase only: the same minyan as if its leading time had reached ten.
export function asOn(o) {
  if (!o) return o;
  const lead = (o.votes || []).reduce((best, x) => (!best || x.count > best.count ? x : best), null);
  const going = [...(lead?.people || o.going)];
  for (const p of o.people) if (going.length < 12 && !going.includes(p)) going.push(p);
  const epoch = lead?.epoch ?? o.epoch;
  return { ...o, on: true, off: false, going, epoch, count: TEN };
}

export function MinyanSlide({ slide, tv, now, tz, sched }) {
  const o = slide.minyan;
  if (!o) return null;
  return o.on ? <On o={o} tv={tv} tz={tz} shabbat={sched?.inPeriod} /> : <Poll o={o} tv={tv} now={now} />;
}

// ── 3. Leaderboard: most minyanim first ──

const nextWords = (r) => <span className={`lb-next ${r.toNext === 1 ? "close" : ""}`}>{r.toNext} to next lunch</span>;

export function LeaderboardSlide({ slide }) {
  const rows = leaders(slide.rows).slice(0, 13);
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  return (
    <div className="slide lb">
      <div className="mx-head">
        <div><p className="mx-eyebrow">All-time</p><h1 className="mx-title">Minyan leaders</h1></div>
        <p className="mx-sub">Every <b>{PER_LUNCH} minyanim</b> earns a free lunch</p>
      </div>
      <div className="lb-podium" style={{ gridTemplateColumns: `repeat(${top.length}, minmax(0, 1fr))` }}>
        {top.map((r, i) => (
          <div key={r.key} className={`mx-card lb-pod ${i === 0 ? "first" : ""}`}>
            <span className="lb-rank">{i + 1}</span>
            <span className="lb-name">{r.short}</span>
            <span className="lb-count"><span><b>{r.count}</b> {r.count === 1 ? "minyan" : "minyanim"}</span>{nextWords(r)}</span>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <div className="lb-rest">
          {rest.map((r, i) => (
            <div key={r.key} className="lb-row"><span className="lb-r">{i + 4}</span><span className="lb-n">{r.short}</span><b>{r.count}</b>{nextWords(r)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 4. Free lunches waiting, A to Z ──

export function LunchesSlide({ slide }) {
  const rows = lunchesWaiting(slide.rows);
  const total = rows.reduce((n, r) => n + r.free, 0);
  return (
    <div className="slide fl">
      <div className="mx-head">
        <div><p className="mx-eyebrow">Ready to redeem</p><h1 className="mx-title">Free lunches</h1></div>
        <div className="fl-total"><b>{total}</b><span>{total === 1 ? "lunch" : "lunches"} waiting</span></div>
      </div>
      <div className={`fl-list ${rows.length > 44 ? "denser" : rows.length > 28 ? "dense" : ""}`}>
        {rows.map((r) => <div key={r.key} className="fl-row"><span>{r.short}</span><b>{r.free}</b></div>)}
      </div>
    </div>
  );
}
