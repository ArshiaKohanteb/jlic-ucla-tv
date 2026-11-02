// Shape of everything stored at /tv in Firebase, plus starting values.
//
// A "time" is either
//   { type: "fixed", value: "18:30" }
//   { type: "zman",  zman: "sunset", offset: -15, round: 5 }
// where zman is any id from the zmanim bridge (sunset, tzet, plag, …) or
// one of candleLighting / havdalah / rabbeinuTam.

export const uid = () => Math.random().toString(36).slice(2, 10);

export const WEEKDAYS = [0, 1, 2, 3, 4];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DEFAULT_SETTINGS = {
  shulName: "JLIC UCLA",
  shulNameHe: "",
  theme: "ivory",
  shabbatTheme: "",
  flip: false,
  effects: "full",
  showSeconds: false,
  // Rotation
  scheduleSeconds: 30,
  flyerSeconds: 12,
  announcementSeconds: 12,
  itemsBetween: 2,
  pairVerticalFlyers: true,
  showCommunity: true,
  showDonateSlide: true,
  showLogoSlide: true,
  logoSeconds: 14,
  communitySeconds: 16,
  communityTitle: "Our Community",
  holdBeforeMinyan: 10,
  contentPaused: false,
  // Schedule screen
  shabbatShowFrom: 4,
  showZmanim: true,
  showLimudim: true,
  showMakam: true,
  showTicker: true,
  showLevana: true,
  showDonate: true,
  tickerSpeed: 60,
  donate: {
    venmo: "@oujlicwest",
    zelle: "aryehkaplan1@gmail.com",
    zelleQr: "https://enroll.zellepay.com/",
    website: "oujlicwest.com",
  },
  // Screen elements
  clock24: false,
  hebrewFont: "Heebo",
  showBsd: true,
  showCivilDate: true,
  showHebrewDate: true,
  showParasha: true,
  showGreeting: true,
  showNextCard: true,
  // Rotation extras
  showFlyers: true,
  showSlides: true,
  slideOrder: "inorder",
  transition: "fade",
  pauseOnShabbat: false,
  // Screens
  nightDim: { enabled: false, start: "23:00", end: "05:00", level: 40 },
  dailyReload: "03:30",
  location: {
    name: "Hillel at UCLA",
    lat: 34.070693,
    long: -118.438491,
    elevation: 0,
    timezone: "America/Los_Angeles",
    candleLighting: 20,
    tzeitMinutes: 30,
  },
  // A poll reaching ten turns to "We're on" by itself
  autoConfirm: true,
  // Hidden zmanim (ids) on the schedule screen
  hiddenZmanim: ["alot", "midnight"],
  // Bumped from the dashboard to force every TV to reload
  reloadToken: 0,
};

export const DEFAULT_MINYANIM = [];

export const DEFAULT_SHABBAT = [
  { id: uid(), name: "Candle Lighting", day: "fri", time: { type: "zman", zman: "candleLighting", offset: 0, round: 0 } },
  { id: uid(), name: "Havdalah", day: "sat", time: { type: "zman", zman: "havdalah", offset: 0, round: 0 } },
];

export const ANNOUNCEMENT_STYLES = {
  info: { label: "Announcement", hint: "General news" },
  celebration: { label: "Mazal Tov", hint: "Weddings, brits, births" },
  sponsor: { label: "Meal sponsor", hint: "Kiddush & seudah sponsors" },
  urgent: { label: "Important", hint: "Changes & urgent notices" },
  memorial: { label: "In Memory", hint: "Hilulot & memorials" },
};

export const OCCASIONS = {
  wedding: { label: "Wedding", line: "on the wedding of", motif: "rings" },
  engagement: { label: "Engagement", line: "on the engagement of", motif: "rings" },
  brit: { label: "Brit Milah", line: "on the brit milah of their son", motif: "star" },
  birthGirl: { label: "Baby girl", line: "on the birth of a baby girl to", motif: "star" },
  birthBoy: { label: "Baby boy", line: "on the birth of a baby boy to", motif: "star" },
  bar: { label: "Bar Mitzvah", line: "on the bar mitzvah of", motif: "star" },
  bat: { label: "Bat Mitzvah", line: "on the bat mitzvah of", motif: "star" },
  other: { label: "Other", line: "", motif: "star" },
};

export const MEALS = ["Kiddush", "Seudat Shelishit", "Breakfast", "Shabbat Dinner", "Melave Malka"];

export const DEDICATIONS = {
  honor: "in honor of",
  memory: "in loving memory of",
  refuah: "for a refuah shelemah for",
  celebration: "in celebration of",
  none: "",
};

export const DEFAULT_ANNOUNCEMENTS = [];

export const DEFAULT_TV = {
  settings: DEFAULT_SETTINGS,
  minyanim: DEFAULT_MINYANIM,
  shabbat: DEFAULT_SHABBAT,
  special: [],
  announcements: DEFAULT_ANNOUNCEMENTS,
  flyers: [],
  photos: [],
};

// Firebase drops empty arrays and turns arrays into objects in some cases.
export const asList = (v) => (Array.isArray(v) ? v.filter(Boolean) : v && typeof v === "object" ? Object.values(v).filter(Boolean) : []);

export function normalizeTv(raw) {
  const r = raw || {};
  return {
    settings: {
      ...DEFAULT_SETTINGS,
      ...(r.settings || {}),
      donate: {
        ...DEFAULT_SETTINGS.donate,
        ...(r.settings?.donate || {}),
        zelleQr: r.settings?.donate?.zelleQr || DEFAULT_SETTINGS.donate.zelleQr,
      },
      nightDim: { ...DEFAULT_SETTINGS.nightDim, ...(r.settings?.nightDim || {}) },
      location: { ...DEFAULT_SETTINGS.location, ...(r.settings?.location || {}) },
      // Mincha Gedola joined the sun path; screens saved before then had it hidden.
      ...(r.settings?.hiddenZmanim && !r.settings?.zmanimV2 ? { hiddenZmanim: r.settings.hiddenZmanim.filter((id) => id !== "minchaGedola") } : {}),
    },
    minyanim: raw ? asList(r.minyanim) : DEFAULT_MINYANIM,
    shabbat: raw ? asList(r.shabbat) : DEFAULT_SHABBAT,
    special: asList(r.special).map((s) => ({ ...s, items: asList(s.items) })),
    announcements: raw ? asList(r.announcements) : DEFAULT_ANNOUNCEMENTS,
    flyers: asList(r.flyers),
    photos: asList(r.photos),
    edits: r.edits || {},
  };
}
