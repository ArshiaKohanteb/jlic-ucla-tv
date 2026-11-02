// The two Hebrew faces the JLIC brand guide allows (both on Google Fonts).
export const HEBREW_FONTS = [
  { id: "Heebo", weights: "300;400;500;700;800" },
  { id: "Open Sans", weights: "400;600;700;800" },
];

// Load the chosen face on demand and point the Hebrew text at it.
export function useHebrewFont(id) {
  const font = HEBREW_FONTS.find((f) => f.id === id) || HEBREW_FONTS[0];
  if (typeof document === "undefined") return font;
  const linkId = "he-font-" + font.id.replace(/\s+/g, "-");
  if (!document.getElementById(linkId)) {
    const l = document.createElement("link");
    l.id = linkId;
    l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${font.id.replace(/ /g, "+")}:wght@${font.weights}&display=swap`;
    document.head.appendChild(l);
  }
  document.documentElement.style.setProperty("--he-font", `"${font.id}"`);
  return font;
}
