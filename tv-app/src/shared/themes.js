// Theme presets for the TV. Each one sets the ambient background (base colour,
// optional photo and its tint, three drifting light orbs), the glass panels,
// the ink, and the "accent" used for what's next.
// "auto" switches between a day and a night preset at sunrise/sunset.


export const THEMES = {
  ivory: {
    name: "JLIC Light",
    blurb: "White with purple type and red accents",
    dark: false,
    vars: {
      "--logo-ink": "#391A92",
      "--bg": "#F5F4FA",
      "--photo": "none",
      "--photo-opacity": "0",
      "--photo-filter": "none",
      "--tint": "linear-gradient(160deg, #FFFFFF 0%, #EBE8F4 100%)",
      "--orb-a": "rgba(57, 26, 146, .08)",
      "--orb-b": "rgba(242, 50, 7, .08)",
      "--orb-c": "rgba(57, 26, 146, .05)",
      "--glass-1": "rgba(255, 255, 255, .86)",
      "--glass-2": "rgba(255, 255, 255, .55)",
      "--glass-border": "rgba(57, 26, 146, .10)",
      "--glass-solid": "rgba(255, 255, 255, .96)",
      "--ink": "#391A92",
      "--muted": "rgba(57, 26, 146, .62)",
      "--acc-1": "#F23207",
      "--acc-2": "#C22706",
      "--acc-ink": "#FFFFFF",
      "--acc-glow": "rgba(242, 50, 7, .26)",
      "--confetti": "#F23207,#391A92,#F99883,#9B8CC8",
    },
  },
  royal: {
    name: "JLIC Purple",
    blurb: "Royal purple with red accents",
    dark: true,
    vars: {
      "--logo-ink": "#FFFFFF",
      "--bg": "#0E0A22",
      "--photo": "none",
      "--photo-opacity": "0",
      "--photo-filter": "none",
      "--tint": "linear-gradient(155deg, #1C1242 0%, #110C2B 60%, #150B26 100%)",
      "--orb-a": "rgba(77, 49, 157, .32)",
      "--orb-b": "rgba(57, 26, 146, .34)",
      "--orb-c": "rgba(242, 50, 7, .10)",
      "--glass-1": "rgba(255, 255, 255, .12)",
      "--glass-2": "rgba(255, 255, 255, .04)",
      "--glass-border": "rgba(255, 255, 255, .20)",
      "--glass-solid": "rgba(41, 18, 102, .92)",
      "--ink": "#FFFFFF",
      "--muted": "rgba(235, 232, 244, .68)",
      "--acc-1": "#F99883",
      "--acc-2": "#F23207",
      "--acc-ink": "#FFFFFF",
      "--acc-glow": "rgba(242, 50, 7, .42)",
      "--confetti": "#F23207,#F99883,#FFFFFF,#EFF340",
    },
  },
};

export const THEME_OPTIONS = [
  ...Object.entries(THEMES).map(([id, t]) => ({ id, ...t })),
  { id: "auto", name: "Day & Night", blurb: "JLIC Light by day, JLIC Purple after sunset", dark: null },
];

// Resolve "auto" (and the optional Shabbat theme) to a concrete preset.
export function resolveTheme(settings, { isNight, isShabbat } = {}) {
  if (isShabbat && THEMES[settings.shabbatTheme]) return settings.shabbatTheme;
  const id = settings.theme || "ivory";
  if (id === "auto") return isNight ? "royal" : "ivory";
  return THEMES[id] ? id : "ivory";
}
