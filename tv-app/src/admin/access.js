// What each manager is allowed to change. Owners can change everything.
// The ids match the dashboard pages and the database rules.
export const AREAS = [
  { id: "schedule", label: "Times", hint: "Minyanim, Shabbat and holiday times" },
  { id: "announcements", label: "Slides", hint: "Announcements, Mazal Tov and sponsors" },
  { id: "media", label: "Media", hint: "Flyers and community photos" },
  { id: "screen", label: "Appearance", hint: "Theme, rotation and quick controls" },
];

export const FULL_ACCESS = Object.fromEntries(AREAS.map((a) => [a.id, true]));

export const PRESETS = [
  { label: "Everything", access: FULL_ACCESS },
  { label: "Times only", access: { ...Object.fromEntries(AREAS.map((a) => [a.id, false])), schedule: true } },
  { label: "Times & media", access: { ...Object.fromEntries(AREAS.map((a) => [a.id, false])), schedule: true, media: true } },
];

// Managers added before access existed keep full access.
export const accessOf = (p) => (p?.role === "owner" || !p?.access ? FULL_ACCESS : { ...Object.fromEntries(AREAS.map((a) => [a.id, false])), ...p.access });
export const can = (user, area) => !!accessOf(user)[area];

export function accessSummary(p) {
  if (p?.role === "owner") return "Everything, plus people and settings";
  const on = AREAS.filter((a) => accessOf(p)[a.id]).map((a) => a.label);
  return on.length === AREAS.length ? "Everything except owner settings" : on.length ? on.join(", ") : "Nothing yet (view only)";
}
