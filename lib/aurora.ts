import * as SunCalc from "suncalc";
import type { KpPoint } from "@/lib/sources/noaa";
import type { MetHour } from "@/lib/sources/met";

const THREE_HOURS = 3 * 60 * 60 * 1000;

/* ---------- Types ---------- */

export type AuroraLevel = "high" | "possible" | "low" | "none" | "daylight";

export type AuroraHour = {
  score: number; // 0–1
  level: AuroraLevel;
  kp: number | null;
  sunAltitude: number; // degrees
};

export type ActivityLevel = "quiet" | "moderate" | "active" | "storm";

export type NightSummary = {
  level: AuroraLevel;
  bestTime: Date | null;
  symbol: string | null;
  maxKp: number | null;
  minCloud: number | null;
  minTemp: number | null;
  maxWind: number | null;
  maxGust: number | null;
  precip: number | null;
};

export type SpotTonight = {
  score: number;
  level: AuroraLevel;
  bestTime: Date | null;
  cloud: number | null;
};

/* ---------- Inputs: Kp, sun, factors ---------- */

// The Kp value for the 3-hour block containing this time
export function kpAt(points: KpPoint[], time: Date): KpPoint | null {
  const t = time.getTime();
  return (
    points.find(
      (p) => t >= p.time.getTime() && t < p.time.getTime() + THREE_HOURS,
    ) ?? null
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

// City lights reduce what you can see (darkness rating 1–5)
const lightFactor = { 1: 0.6, 2: 0.75, 3: 0.85, 4: 0.95, 5: 1 } as const;

/* ---------- Score and words ---------- */

// Version 1 thresholds: tune these with real nights and guide feedback
export function levelFromScore(score: number): AuroraLevel {
  if (score >= 0.6) return "high";
  if (score >= 0.35) return "possible";
  if (score >= 0.15) return "low";
  return "none";
}

// Kp turned into words people understand
export function activityLevel(kp: number): ActivityLevel {
  if (kp >= 5) return "storm";
  if (kp >= 3) return "active";
  if (kp >= 2) return "moderate";
  return "quiet";
}

// Aurora chance for one hour at one place: activity × sky × darkness
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
  return { score, level: levelFromScore(score), kp, sunAltitude: altitude };
}

/* ---------- Picking the best hour ---------- */

// Picks the earliest hour that is nearly as good as the best one (within 90%),
// so evening hours win over early morning when the night is evenly good.
// `items` must be in time order.
export function pickBest<T>(
  items: T[],
  score: (item: T) => number,
  tolerance = 0.9,
) {
  const max = Math.max(0, ...items.map(score));
  if (max <= 0) return { best: null, last: null, max: 0 };

  const good = items.filter((item) => score(item) >= max * tolerance);
  return { best: good[0], last: good[good.length - 1], max };
}

/* ---------- Night summary (Forecast page) ---------- */

const present = (v: number | null): v is number => v !== null;

export function summarizeNight(
  hours: MetHour[],
  kpPoints: KpPoint[],
  lat: number,
  lon: number,
): NightSummary {
  const rows = hours.map((h) => ({
    h,
    a: auroraForHour(h, kpPoints, lat, lon),
  }));
  const pick = pickBest(rows, (r) => r.a.score);

  const kps = rows.map((r) => r.a.kp).filter(present);
  const clouds = hours.map((h) => h.cloudTotal).filter(present);
  const temps = hours.map((h) => h.temperature).filter(present);
  const winds = hours.map((h) => h.windSpeed).filter(present);
  const gusts = hours.map((h) => h.windGust).filter(present);
  const precips = hours.map((h) => h.precipitation).filter(present);

  return {
    level: pick.best ? levelFromScore(pick.max) : "none",
    bestTime: pick.best?.h.time ?? null,
    symbol: pick.best?.h.symbol ?? hours[0]?.symbol ?? null,
    maxKp: kps.length ? Math.max(...kps) : null,
    minCloud: clouds.length ? Math.min(...clouds) : null,
    minTemp: temps.length ? Math.min(...temps) : null,
    maxWind: winds.length ? Math.max(...winds) : null,
    maxGust: gusts.length ? Math.max(...gusts) : null,
    precip: precips.length ? precips.reduce((sum, p) => sum + p, 0) : null,
  };
}

/* ---------- Spot ranking (Tonight page map) ---------- */

export function spotTonight(
  hours: MetHour[],
  kpPoints: KpPoint[],
  spot: {
    lat: number;
    lon: number;
    darkness: 1 | 2 | 3 | 4 | 5;
    viewNorth: boolean;
  },
): SpotTonight {
  const scored = hours.map((h) => ({
    h,
    score:
      auroraForHour(h, kpPoints, spot.lat, spot.lon).score *
      lightFactor[spot.darkness] *
      (spot.viewNorth ? 1 : 0.85),
  }));

  const pick = pickBest(scored, (s) => s.score);
  if (!pick.best)
    return { score: 0, level: "none", bestTime: null, cloud: null };

  return {
    score: pick.max,
    level: levelFromScore(pick.max),
    bestTime: pick.best.h.time,
    cloud: pick.best.h.cloudTotal,
  };
}
