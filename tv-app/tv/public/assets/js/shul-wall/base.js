// @ts-check

import { GeoLocation, Temporal } from "../../libraries/kosherZmanim/kosher-zmanim.js";
import { ZemanFunctions } from "../ROYZmanim.js";
import WebsiteLimudCalendar from "../WebsiteLimudCalendar.js";

/** @typedef {{
    seconds: boolean;
    timeFormat: "h11" | "h12" | "h23" | "h24";
    language: "hb" | "en" | "en-et";
    location: {
        name: string;
        lat: number;
        long: number;
        elevation: number;
        timezone: string;
    };
    calendarToggle: {
        rtKulah: boolean;
        tekufaMidpoint: "hatzoth" | "arbitrary";
        tekufaCalc: "shemuel" | "adabaravah";
        forceSunSeasonal: boolean;
    },
    customTimes: {
        candleLighting: number,
        tzeithIssurMelakha: { minutes: number, degree?: number }
    },
    schedule?: "manual" | {
        url: string;
        type: "excel" | "ini" | "json";
        forUpcoming?: boolean;
    }
}} ScheduleSettings */

/** @type {ScheduleSettings} */
const scheduleSettings = JSON.parse(document.getElementById("zy-scheduleScreen-config").textContent)

/** @type {[string, number, number, number, string]} */
// @ts-ignore
const glArgs = Object.values(scheduleSettings.location)
const geoLocation = new GeoLocation(...glArgs);

// ─── Frozen constants (kept for any existing consumers) ───
const currentZDT = Temporal.Now.zonedDateTimeISO(scheduleSettings.location.timezone);

const jCal = new WebsiteLimudCalendar(currentZDT.toPlainDate());
jCal.setInIsrael((geoLocation.getLocationName() || "").toLowerCase().includes('israel'))

const zmanCalc = new ZemanFunctions(geoLocation, {
    elevation: jCal.getInIsrael(),
    rtKulah: scheduleSettings.calendarToggle.rtKulah,
    candleLighting: scheduleSettings.customTimes.candleLighting,
    fixedMil: scheduleSettings.calendarToggle.forceSunSeasonal || jCal.getInIsrael(),
    melakha: scheduleSettings.customTimes.tzeithIssurMelakha
})
zmanCalc.setDate(currentZDT.toPlainDate());

/** @type {number[]} */
let availableVS = [];
if (typeof localStorage !== "undefined" && localStorage.getItem('ctNetz') && isValidJSON(localStorage.getItem('ctNetz'))) {
    const ctNetz = JSON.parse(localStorage.getItem('ctNetz'))
    if ('url' in ctNetz) {
        const ctNetzLink = new URL(ctNetz.url);
        if (ctNetzLink.searchParams.get('cgi_eroslatitude') == geoLocation.getLatitude().toFixed(6)
        && ctNetzLink.searchParams.get('cgi_eroslongitude') == (-geoLocation.getLongitude()).toFixed(6))
            availableVS = ctNetz.times
    }
}
zmanCalc.setVisualSunrise(availableVS);

/** @type {[string | string[], options?: Intl.DateTimeFormatOptions]} */
const dtF = [scheduleSettings.language == 'hb' ? 'he' : 'en', {
    hourCycle: scheduleSettings.timeFormat,
    hour: 'numeric',
    minute: '2-digit'
}];

// ─── Live getter functions for bridge.js recalculation ───
// Each call builds fresh objects based on the current wall-clock time,
// so zmanim update correctly after midnight without a page reload.

function getCurrentZDT() {
    return Temporal.Now.zonedDateTimeISO(scheduleSettings.location.timezone);
}

function getJCal() {
    const now = getCurrentZDT();
    const cal = new WebsiteLimudCalendar(now.toPlainDate());
    cal.setInIsrael((geoLocation.getLocationName() || "").toLowerCase().includes('israel'));
    return cal;
}

function getZmanCalc() {
    const now = getCurrentZDT();
    const cal = getJCal();
    const calc = new ZemanFunctions(geoLocation, {
        elevation: cal.getInIsrael(),
        rtKulah: scheduleSettings.calendarToggle.rtKulah,
        candleLighting: scheduleSettings.customTimes.candleLighting,
        fixedMil: scheduleSettings.calendarToggle.forceSunSeasonal || cal.getInIsrael(),
        melakha: scheduleSettings.customTimes.tzeithIssurMelakha
    });
    calc.setDate(now.toPlainDate());
    calc.setVisualSunrise(availableVS);
    return calc;
}

export { scheduleSettings, geoLocation, currentZDT, jCal, zmanCalc, dtF, getCurrentZDT, getJCal, getZmanCalc };

/**
 * @param {string} str
 */
function isValidJSON(str) {
    try {
        JSON.parse(str);
        return true;
    } catch (e) {
        return false;
    }
}
