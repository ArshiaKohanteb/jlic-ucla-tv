// The free-lunch ticket the WhatsApp bot links to: uclaminyan.com/lunch/#<ticket>.
// Staff at OKT check two things: it says today, and the clock is ticking (a screenshot
// doesn't move). It stops being valid 20 minutes after it was asked for.
import "./lunch.css";
import { get, ref } from "firebase/database";
import { db } from "../shared/firebase.js";

const TZ = "America/Los_Angeles";
const box = document.getElementById("ticket");
const token = location.hash.replace(/^#/, "").trim();

const fmt = (ms, opts) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(new Date(ms));
const dayOf = (ms) => fmt(ms, { year: "numeric", month: "2-digit", day: "2-digit" });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function show(kind, title, detail = "") {
  box.className = `ticket ${kind}`;
  box.innerHTML = `<p class="state">${esc(title)}</p>${detail ? `<p class="detail">${esc(detail)}</p>` : ""}`;
}

async function main() {
  if (!/^[A-Za-z0-9_-]{12,64}$/.test(token)) return show("bad", "This link isn't a lunch ticket.", "Message the minyan bot \"lunch\" to get one.");
  let t;
  try {
    t = (await get(ref(db, `meals/${token}`))).val();
  } catch {
    return show("bad", "Couldn't load the ticket.", "Check your connection and reload.");
  }
  if (!t) return show("bad", "Ticket not found.", "Message the minyan bot \"lunch\" to get one.");

  box.className = "ticket live";
  box.innerHTML = `
    <div class="band" aria-hidden="true"></div>
    <p class="where">OKT · JLIC UCLA</p>
    <h1>Free lunch</h1>
    <p class="name">${esc(t.short || t.name || "Guest")}</p>
    <p class="date">${esc(fmt(t.at, { weekday: "long", month: "long", day: "numeric" }))}</p>
    <div class="clock" aria-label="Current time"><span id="hm"></span><span id="sec"></span><span id="ap"></span></div>
    <p class="until" id="until"></p>
    <p class="foot">${t.left > 0 ? `${t.left} more free ${t.left === 1 ? "lunch" : "lunches"} after this one` : "Thanks for coming to minyan!"}</p>`;

  const tick = () => {
    const now = Date.now();
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(now)).map((x) => [x.type, x.value]));
    document.getElementById("hm").textContent = `${p.hour}:${p.minute}`;
    document.getElementById("sec").textContent = `:${p.second}`;
    document.getElementById("ap").textContent = p.dayPeriod;
    const left = t.expires - now;
    const expired = left <= 0 || dayOf(now) !== dayOf(t.at);
    box.classList.toggle("expired", expired);
    document.getElementById("until").textContent = expired
      ? `Expired at ${fmt(t.expires, { hour: "numeric", minute: "2-digit" })}`
      : `Valid for ${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, "0")} more`;
  };
  tick();
  setInterval(tick, 250);
}

main();
