import React, { useMemo } from "react";
import { Brand, Clock, Ornament } from "./common.jsx";

// Each layout is a list of grid areas on a 12×6 grid: [col, row, colSpan, rowSpan].
const LAYOUTS = [
  [[1, 1, 7, 6], [8, 1, 5, 3], [8, 4, 5, 3]],
  [[1, 1, 6, 6], [7, 1, 3, 3], [10, 1, 3, 3], [7, 4, 6, 3]],
  [[1, 1, 4, 6], [5, 1, 4, 3], [9, 1, 4, 6], [5, 4, 4, 3]],
  [[1, 1, 5, 4], [6, 1, 4, 3], [10, 1, 3, 3], [1, 5, 5, 2], [6, 4, 7, 3]],
  [[1, 1, 3, 3], [4, 1, 6, 6], [10, 1, 3, 3], [1, 4, 3, 3], [10, 4, 3, 3]],
];

// Remember what was just on screen so the next collage shows something new.
let recentlyShown = new Set();

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick(photos, n) {
  const fresh = shuffle(photos.filter((p) => !recentlyShown.has(p.id)));
  const seen = shuffle(photos.filter((p) => recentlyShown.has(p.id)));
  const chosen = [...fresh, ...seen].slice(0, n);
  // Once most of the library has been shown, start the cycle over.
  recentlyShown = photos.length - recentlyShown.size <= n ? new Set(chosen.map((p) => p.id)) : new Set([...recentlyShown, ...chosen.map((p) => p.id)]);
  return chosen;
}

const DRIFTS = ["drift-1", "drift-2", "drift-3", "drift-4"];

// Chosen ahead of time by the rotation so the photos can be decoded before the slide appears.
export function pickCollage(tv) {
  const library = (tv.photos || []).filter((p) => p.url && p.active !== false);
  const fits = LAYOUTS.filter((l) => l.length <= library.length);
  const layout = fits[Math.floor(Math.random() * fits.length)] || LAYOUTS[0];
  return { layout, photos: pick(library, layout.length) };
}

export default function CommunityScene({ tv, tz, slide }) {
  const s = tv.settings;
  const { layout, photos } = useMemo(() => slide?.pick || pickCollage(tv), []);

  return (
    <div className="scene scene-community" style={{ "--secs": `${(s.communitySeconds || 16) + 2}s` }}>
      <div className="collage">
        {photos.map((p, i) => {
          const [c, r, cs, rs] = layout[i];
          return (
            <figure key={p.id} className="tile" style={{ gridArea: `${r} / ${c} / span ${rs} / span ${cs}`, animationDelay: `${0.15 + i * 0.14}s` }}>
              <img src={p.url} alt="" decoding="async" className={DRIFTS[(i + Math.floor(Math.random() * 4)) % 4]} />
            </figure>
          );
        })}
      </div>
      <div className="community-label glass">
        <Brand tv={tv} small />
        <div className="community-title">
          <span>{s.communityTitle || "Our Community"}</span>
          <Ornament />
        </div>
        <Clock tz={tz} className="clock-foot" />
      </div>
    </div>
  );
}
