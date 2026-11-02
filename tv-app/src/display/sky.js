// The screen's colour is the real sky over Westwood: each stop is a moment the
// zmanim already give us, and everything between is blended minute by minute.
const NIGHT = ["#07080F", "#0C1020", "#10152B"];
const stops = (d) => {
  const M = 60_000, noon = d.hatzot || (d.sunrise + d.sunset) / 2;
  return [
    [d.sunrise - 100 * M, NIGHT],
    [d.sunrise - 45 * M, ["#0A0E22", "#1B1B3C", "#3A2B57"]],
    [d.sunrise, ["#161F42", "#5A3F62", "#B9623F"]],
    [d.sunrise + 70 * M, ["#0D2545", "#17406B", "#2B6690"]],
    [noon, ["#0B2A52", "#134474", "#24679A"]],
    [d.sunset - 80 * M, ["#10284B", "#23456C", "#49708A"]],
    [d.sunset, ["#191B3E", "#5B3457", "#B2592E"]],
    [(d.tzet || d.sunset + 13 * M) + 10 * M, ["#0C0E24", "#1B1838", "#3A2848"]],
    [(d.tzet || d.sunset + 13 * M) + 70 * M, NIGHT],
  ];
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => {
  const A = rgb(a), B = rgb(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`;
};

export function skyGradient(day, now) {
  let colors = NIGHT;
  if (day?.sunrise && day?.sunset) {
    const s = stops(day);
    const i = s.findIndex(([t]) => t > now);
    if (i > 0) {
      const [t0, c0] = s[i - 1], [t1, c1] = s[i];
      colors = c0.map((c, n) => mix(c, c1[n], (now - t0) / (t1 - t0)));
    }
  }
  return `linear-gradient(180deg, ${colors[0]} 0%, ${colors[1]} 62%, ${colors[2]} 100%)`;
}
