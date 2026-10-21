import * as SunCalc from "suncalc";
import type { KpPoint } from "@/lib/sources/noaa"
import type { MetHour } from "@/lib/sources/met";

const THREE_HOURS = 3 * 60 * 60 * 1000;

export type AuroraLevel = "high" | "possible" | "low" | "none" | "daylight";

export type AuroraHour = {
  score: number; // 0–1
  level: AuroraLevel;
  kp: number | null;
  sunAltitude: number; // degrees
};

// The Kp value for the 3-hour block containing this time
export function kpAt(points: KpPoint[], time: Date): KpPoint | null {
  const t = time.getTime();
  return (
    points.find((p) => t >= p.time.getTime() && t < p.time.getTime() + THREE_HOURS) ?? null
  );
}

export function sunAltitude(time: Date, lat: number, lon: number): number {
  return (SunCalc.getPosition(time, lat, lon).altitude * 180) / Math.PI;
}

// Sun below -12° = dark enough. Between -6° and -12° = twilight, weaker aurora.
function darknessFactor(altitude: number): number {
  if (altitude <= -12) return 1;
  if (altitude <= -6) return 0.5;
  return 0;
}

// Bodø sits under the aurora zone, so even low Kp can give aurora
function activityFactor(kp: number | null): number {
  if (kp === null) return 0.5; // unknown: neutral guess
  if (kp >= 3) return 1;
  if (kp >= 2) return 0.8;
  if (kp >= 1) return 0.55;
  return 0.3;
}

function skyFactor(cloud: number | null): number {
  if (cloud === null) return 0.5;
  return Math.max(0, 1 - cloud / 100);
}

export function auroraForHour(
  hour: MetHour,
  kpPoints: KpPoint[],
  lat: number,
  lon: number,
): AuroraHour {
  const altitude = sunAltitude(hour.time, lat, lon);
  const kp = kpAt(kpPoints, hour.time)?.kp ?? null;
  const dark = darknessFactor(altitude);

  if (dark === 0) {
    return { score: 0, level: "daylight", kp, sunAltitude: altitude };
  }

  const score = activityFactor(kp) * skyFactor(hour.cloudTotal) * dark;

  // Version 1 thresholds: tune these with real nights and guide feedback
  const level: AuroraLevel =
    score >= 0.6 ? "high" : score >= 0.35 ? "possible" : score >= 0.15 ? "low" : "none";

  return { score, level, kp, sunAltitude: altitude };
}

export type ActivityLevel = "quiet" | "moderate" | "active" | "storm";

// Kp turned into words people understand
export function activityLevel(kp: number): ActivityLevel {
  if (kp >= 5) return "storm";
  if (kp >= 3) return "active";
  if (kp >= 2) return "moderate";
  return "quiet";
}

export type NightSummary = {
  level: AuroraLevel;
  bestTime: Date | null;
  symbol: string | null;
  maxKp: number | null;
  minCloud: number | null;
  minTemp: number | null;
  maxWind: number | null;
  precip: number | null;
};

const present = (v: number | null): v is number => v !== null;

export function summarizeNight(
  hours: MetHour[],
  kpPoints: KpPoint[],
  lat: number,
  lon: number,
): NightSummary {
  const rows = hours.map((h) => ({ h, a: auroraForHour(h, kpPoints, lat, lon) }));

  const best = rows.reduce<(typeof rows)[number] | null>(
    (b, r) => (r.a.score > (b?.a.score ?? 0) ? r : b),
    null,
  );

  const kps = rows.map((r) => r.a.kp).filter(present);
  const clouds = hours.map((h) => h.cloudTotal).filter(present);
  const temps = hours.map((h) => h.temperature).filter(present);
  const winds = hours.map((h) => h.windSpeed).filter(present);
  const precips = hours.map((h) => h.precipitation).filter(present);

  return {
    level: best?.a.level ?? "none",
    bestTime: best?.h.time ?? null,
    symbol: best?.h.symbol ?? hours[0]?.symbol ?? null,
    maxKp: kps.length ? Math.max(...kps) : null,
    minCloud: clouds.length ? Math.min(...clouds) : null,
    minTemp: temps.length ? Math.min(...temps) : null,
    maxWind: winds.length ? Math.max(...winds) : null,
    precip: precips.length ? precips.reduce((sum, p) => sum + p, 0) : null,
  };
}