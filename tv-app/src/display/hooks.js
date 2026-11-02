import { useEffect, useRef, useState } from "react";
import { subscribeTv } from "../shared/store.js";

export function useZmanim() {
  const [z, setZ] = useState(() => window.__TV_ZMANIM__ || null);
  useEffect(() => {
    const on = (e) => setZ({ ...e.detail });
    window.addEventListener("tv-zmanim-ready", on);
    if (window.__TV_ZMANIM__) setZ({ ...window.__TV_ZMANIM__ });
    return () => window.removeEventListener("tv-zmanim-ready", on);
  }, []);
  return z;
}

export function useTv() {
  const [tv, setTv] = useState(null);
  const reloadToken = useRef(null);
  useEffect(() => subscribeTv((data, meta) => {
    setTv(data);
    // A dashboard "Restart TV" bumps reloadToken; reload when it changes.
    const token = data.settings.reloadToken || 0;
    if (meta.fromServer) {
      if (reloadToken.current !== null && token !== reloadToken.current) location.reload();
      reloadToken.current = token;
    }
  }), []);
  return tv;
}

// Re-render every `ms`, aligned to the clock so minutes flip on time.
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let t;
    const loop = () => {
      setNow(Date.now());
      t = setTimeout(loop, ms - (Date.now() % ms) + 5);
    };
    t = setTimeout(loop, ms - (Date.now() % ms) + 5);
    return () => clearTimeout(t);
  }, [ms]);
  return now;
}

// Lay the screen out at TV scale: the shorter side maps to 1080 (or 1920) design
// pixels and the other side stretches, so any screen shape is filled edge to edge.
export function useStage(w = 1920, h = 1080) {
  const calc = () => {
    const W = window.innerWidth, H = window.innerHeight;
    // Fill TV-like shapes (4:3 up to ultra-wide); anything taller, like a phone
    // held upright, is letterboxed instead of stretched into a giant stage.
    const aspect = Math.min(2.6, Math.max(4 / 3, W / H));
    const sw = Math.max(w, Math.round(h * aspect));
    const sh = Math.max(h, Math.round(sw / aspect));
    const scale = Math.min(W / sw, H / sh);
    // Whole-pixel position, so text isn't drawn between pixels (blurry)
    return { scale, w: sw, h: sh, x: Math.round((W - sw * scale) / 2), y: Math.round((H - sh * scale) / 2) };
  };
  const [stage, setStage] = useState(calc);
  useEffect(() => {
    const on = () => setStage(calc());
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("orientationchange", on); };
  }, []);
  return stage;
}

// Remember each image's natural size so flyers can be laid out by shape.
const sizeCache = new Map();
export function useImageSizes(urls) {
  const [, force] = useState(0);
  useEffect(() => {
    let alive = true;
    urls.forEach((u) => {
      if (!u || sizeCache.has(u)) return;
      sizeCache.set(u, null);
      const img = new Image();
      img.onload = () => { sizeCache.set(u, { w: img.naturalWidth, h: img.naturalHeight }); if (alive) force((n) => n + 1); };
      img.onerror = () => { sizeCache.set(u, { w: 0, h: 0, error: true }); if (alive) force((n) => n + 1); };
      img.src = u;
    });
    return () => { alive = false; };
  }, [urls.join("|")]);
  return sizeCache;
}
