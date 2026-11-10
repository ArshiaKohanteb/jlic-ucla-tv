import { isLive } from "../shared/schedule.js";

const shapeOf = (f, sizes) => {
  const s = f.w && f.h ? { w: f.w, h: f.h } : sizes.get(f.url);
  if (!s || !s.w) return "tall";
  return s.w / s.h >= 1.25 ? "wide" : "tall";
};

// Ordered list of content slides (flyers + announcement cards).
export function buildContent(tv, today, sizes) {
  const s = tv.settings;
  const linkable = (a) => !["celebration", "sponsor"].includes(a.style);
  const cardList = (s.showSlides === false ? [] : tv.announcements || [])
    .filter((a) => a.slide !== false && isLive(a, today) && (a.title || a.body));
  const byId = new Map((tv.flyers || []).filter((f) => f.url && !sizes.get(f.url)?.error).map((f) => [f.id, f]));
  const linked = new Set(cardList.filter((a) => linkable(a) && byId.has(a.flyerId)).map((a) => a.flyerId));

  const flyers = (s.showFlyers === false ? [] : tv.flyers || [])
    .filter((f) => f.url && isLive(f, today) && !sizes.get(f.url)?.error && !linked.has(f.id))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const flyerSlides = [];
  let waiting = null;
  for (const f of flyers) {
    const shape = shapeOf(f, sizes);
    if (shape === "wide") {
      flyerSlides.push({ kind: "flyer", layout: "wide", items: [f], key: f.id });
    } else if (s.pairVerticalFlyers && !f.solo) {
      if (waiting) {
        flyerSlides.push({ kind: "flyer", layout: "pair", items: [waiting, f], key: waiting.id + f.id });
        waiting = null;
      } else waiting = f;
    } else {
      flyerSlides.push({ kind: "flyer", layout: "tall", items: [f], key: f.id });
    }
  }
  if (waiting) flyerSlides.push({ kind: "flyer", layout: "tall", items: [waiting], key: waiting.id });

  const cards = cardList.map((a) => {
    const flyer = linkable(a) ? byId.get(a.flyerId) : null;
    return flyer ? { kind: "announcement", item: a, flyer, items: [flyer], key: a.id + flyer.id } : { kind: "announcement", item: a, key: a.id };
  });

  // Interleave so flyers and announcements alternate; the community collage
  // (a fresh random pick each time) sits in the middle of the loop.
  const out = [];
  const n = Math.max(flyerSlides.length, cards.length);
  for (let i = 0; i < n; i++) {
    if (flyerSlides[i]) out.push(flyerSlides[i]);
    if (cards[i]) out.push(cards[i]);
  }
  const photos = (tv.photos || []).filter((p) => p.url && p.active !== false);
  if (s.showCommunity !== false && photos.length >= 3) {
    out.splice(Math.ceil(out.length / 2), 0, { kind: "community", key: "community" });
  }
  const d = s.donate || {};
  if (s.showDonateSlide !== false && (d.venmo || d.zelle || d.website)) out.push({ kind: "donate", key: "donate" });
  if (s.showLogoSlide !== false) out.push({ kind: "logo", key: "logo" });
  return out;
}

export function slideSeconds(slide, settings) {
  if (slide.kind === "schedule") return settings.scheduleSeconds || 30;
  if (slide.kind === "shabbat") return settings.announcementSeconds || 12;
  if (slide.kind === "donate") return settings.announcementSeconds || 12;
  if (slide.kind === "logo") return settings.logoSeconds || 14;
  if (slide.kind === "minyan") return settings.minyanSeconds || 18;
  if (slide.kind === "leaderboard" || slide.kind === "lunches") return settings.leaderboardSeconds || 16;
  if (slide.kind === "community") return settings.communitySeconds || 16;
  if (slide.kind === "announcement") return slide.item.seconds || settings.announcementSeconds || 12;
  const custom = Math.max(...slide.items.map((f) => f.seconds || 0));
  return custom || settings.flyerSeconds || 12;
}
