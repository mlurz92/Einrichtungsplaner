// Sonnenstand nach NOAA (vereinfachte Reihenentwicklung, Genauigkeit ≈ 0,5°): reicht für die Frage,
// wann und wo Sonne durch welches Fenster fällt. Ortszeit = mitteleuropäische Zeit inkl. Sommerzeit.

const RAD = Math.PI / 180;

export interface SunPosition {
  /** Höhe über dem Horizont in Grad (negativ = unter dem Horizont). */
  elevation: number;
  /** Azimut in Grad, von Nord im Uhrzeigersinn (90 = Ost, 180 = Süd). */
  azimuth: number;
}

export interface SunSite {
  latitude: number;
  longitude: number;
}

/** Standard: Mitte Deutschlands. */
export const DEFAULT_SITE: SunSite = { latitude: 51.2, longitude: 10.4 };

/** Letzter Sonntag eines Monats (Tag im Monat). */
function lastSunday(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month + 1, 0));
  return last.getUTCDate() - last.getUTCDay();
}

/** UTC-Versatz der Ortszeit (MEZ 1 h, MESZ 2 h) für ein Kalenderdatum. */
export function utcOffset(year: number, month: number, day: number): number {
  const start = lastSunday(year, 2);
  const end = lastSunday(year, 9);
  const afterStart = month > 2 || (month === 2 && day >= start);
  const beforeEnd = month < 9 || (month === 9 && day < end);
  return afterStart && beforeEnd ? 2 : 1;
}

/** Datum "JJJJ-MM-TT" → [Jahr, Monat (0–11), Tag]; ungültig → heutiges Datum. */
export function parseDate(s: string | undefined): [number, number, number] {
  const m = s && /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const d = new Date();
  return [d.getFullYear(), d.getMonth(), d.getDate()];
}

export function sunPosition(date: string | undefined, localHours: number, site: SunSite = DEFAULT_SITE): SunPosition {
  const [y, mo, d] = parseDate(date);
  const utcH = localHours - utcOffset(y, mo, d);
  const doy = Math.round((Date.UTC(y, mo, d) - Date.UTC(y, 0, 1)) / 86400000) + 1;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const g = ((2 * Math.PI) / (leap ? 366 : 365)) * (doy - 1 + (utcH - 12) / 24);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const trueSolarMin = utcH * 60 + eqTime + 4 * site.longitude;
  const ha = (trueSolarMin / 4 - 180) * RAD;
  const lat = site.latitude * RAD;
  const cosZ = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const zenith = Math.acos(Math.max(-1, Math.min(1, cosZ)));
  const az = Math.atan2(Math.sin(ha), Math.cos(ha) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)) / RAD + 180;
  return { elevation: 90 - zenith / RAD, azimuth: ((az % 360) + 360) % 360 };
}

/**
 * Richtung zur Sonne in Weltkoordinaten (x = Plan rechts, y = oben, z = Plan unten).
 * northDeg: Lage von Norden im Plan, im Uhrzeigersinn von „Plan oben“ gemessen.
 */
export function sunDirection(pos: SunPosition, northDeg: number): [number, number, number] {
  const b = (pos.azimuth + northDeg) * RAD;
  const el = pos.elevation * RAD;
  return [Math.sin(b) * Math.cos(el), Math.sin(el), -Math.cos(b) * Math.cos(el)];
}

/** Sonnenauf- und -untergang (Ortszeit, Stunden) durch Abtasten; null bei Polartag/-nacht. */
export function sunTimes(date: string | undefined, site: SunSite = DEFAULT_SITE): { rise: number; set: number } | null {
  let rise: number | null = null;
  let set: number | null = null;
  let prev = sunPosition(date, 0, site).elevation;
  for (let m = 5; m <= 24 * 60; m += 5) {
    const e = sunPosition(date, m / 60, site).elevation;
    if (prev < -0.83 && e >= -0.83 && rise == null) rise = m / 60;
    if (prev >= -0.83 && e < -0.83) set = m / 60;
    prev = e;
  }
  return rise != null && set != null ? { rise, set } : null;
}

export function fmtClock(h: number): string {
  const t = Math.round(h * 60);
  return `${Math.floor(t / 60) % 24}:${String(t % 60).padStart(2, "0")}`;
}
