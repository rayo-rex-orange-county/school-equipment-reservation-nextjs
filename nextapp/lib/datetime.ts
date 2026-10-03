// Teachers pick a date ("YYYY-MM-DD") and a time ("HH:MM", 24h) in the
// wizard. Those need to mean the same wall-clock moment for every teacher at
// this one school, no matter which timezone the Node server process happens
// to run in (many hosts default to UTC) or which timezone a viewer's own
// browser/OS is set to. Relying on either machine's "local" time — as a
// naive `new Date(y,m,d,h,min)` does — breaks the moment those two differ.
//
// Instead every absolute instant is built and read back against ONE fixed,
// explicit offset for the school: Asia/Manila, UTC+8, which the Philippines
// does not vary with daylight saving. That makes the conversion a plain
// additions/subtraction rather than requiring a timezone database.
//
// Deploying this for a school in a zone that *does* observe DST: replace
// SCHOOL_TZ_OFFSET_MINUTES with a lookup (e.g. the `Intl.DateTimeFormat`
// offset trick, or the `date-fns-tz` / `luxon` packages) so the offset can
// change across the year — the rest of this file stays the same either way.
export const SCHOOL_TZ_OFFSET_MINUTES = 480; // Asia/Manila, UTC+8, no DST

/** Wall-clock picks -> absolute instant (what gets stored in Postgres). */
export function combineDateTime(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, h, min, 0, 0) - SCHOOL_TZ_OFFSET_MINUTES * 60000;
  return new Date(utcMs);
}

/** Absolute instant (e.g. `new Date(reservation.startDateTime)` from the
 *  API) -> the school's wall-clock date. This is the ONLY correct way to
 *  read a stored timestamp back for display — never call `.getDate()` /
 *  `.getHours()` etc. directly on one, since those read the *runtime's*
 *  local time, not the school's. */
export function toDateStr(instant: Date): string {
  const shifted = new Date(instant.getTime() + SCHOOL_TZ_OFFSET_MINUTES * 60000);
  return shifted.getUTCFullYear() + "-" + String(shifted.getUTCMonth() + 1).padStart(2, "0") + "-" + String(shifted.getUTCDate()).padStart(2, "0");
}
export function toTimeStr(instant: Date): string {
  const shifted = new Date(instant.getTime() + SCHOOL_TZ_OFFSET_MINUTES * 60000);
  return String(shifted.getUTCHours()).padStart(2, "0") + ":" + String(shifted.getUTCMinutes()).padStart(2, "0");
}

export function todayStr(): string {
  return toDateStr(new Date());
}

/** The instant 00:00 school-local time falls on for a given calendar date —
 *  useful for "reservations on or after today" range queries. */
export function startOfDayInstant(dateStr: string): Date {
  return combineDateTime(dateStr, "00:00");
}

// ---- pure calendar-date arithmetic -----------------------------------
// Everything below treats "YYYY-MM-DD" as a bare calendar date with no
// time-of-day or timezone meaning at all (adding days, finding a weekday,
// walking a month grid). It deliberately never touches an absolute instant
// or either machine's local clock, so it's trivially correct everywhere —
// kept as plain UTC-anchored scratch Dates purely as a calendar calculator.
export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.getUTCFullYear() + "-" + String(dt.getUTCMonth() + 1).padStart(2, "0") + "-" + String(dt.getUTCDate()).padStart(2, "0");
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return MONTHS[m - 1] + " " + d + ", " + y;
}
export function fmtDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] + ", " + fmtDate(dateStr);
}
export function fmtTime(timeStr: string): string {
  let [h, m] = timeStr.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return h + ":" + String(m).padStart(2, "0") + " " + ap;
}
export function fmtRange(startTime: string, endTime: string): string {
  return fmtTime(startTime) + "\u2013" + fmtTime(endTime);
}

/** Two half-open intervals overlap when each starts before the other ends.
 *  Touching endpoints (9-11 then 11-1) do NOT overlap. Works on raw Date
 *  instants, so it is correct regardless of how they were constructed. */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}
