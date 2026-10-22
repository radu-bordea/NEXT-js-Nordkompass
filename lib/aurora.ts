/**
 * Step 1: aurora FORECAST score (plan for tonight and the next nights)
 *
 * score per hour = activity × clear sky × darkness × moon
 *
 *   activity   NOAA Kp forecast for that 3-hour block (same for the whole planet)
 *   clear sky  MET cloud cover that hour (0% cloud → 1, 100% → 0)
 *   darkness   sun below −12° = 1, −6° to −12° = 0.5, above −6° = daylight (score 0)
 *   moon       bright moon high in the sky lowers weak/medium aurora up to −15%
 *              (lib/moon.ts). Kp 3+ (strong for Bodø) is not affected.
 *
 * For spots, two more factors: light pollution (darkness rating 1–5) and
 * whether the spot has an open view to the north.
 *
 * Score → level: high ≥ 0.6, possible ≥ 0.35, low ≥ 0.15, else none.
 * These thresholds are version 1: tune them with the sighting log.
 *
 * Step 2 (live, "right now") is in lib/aurora-live.ts.
 */

import type { KpPoint } from "@/lib/sources/noaa";
import type { MetHour } from "@/lib/sources/met";
import { sunAltitudeDeg } from "@/lib/astro";
import { moonFactor, moonTonight, type MoonTonight } from "@/lib/moon";

const THREE_HOURS = 3 * 60 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

/* ---------- Types ---------- */

export type AuroraLevel = "high" | "possible" | "low" | "none" | "daylight";

export type AuroraHour = {
  score: number; // 0–1
  level: AuroraLevel;
  kp: number | null;
  sunAltitude: number; // degrees
  moon: number; // moon factor 0.85–1 (1 = no effect)
};

export type ActivityLevel = "quiet" | "moderate" | "active" | "storm";

export type NightSummary = {
  level: AuroraLevel;
  bestTime: Date | null;
  goodFrom: Date | null; // start of the good window
  goodUntil: Date | null; // end of the good window
  symbol: string | null;
  maxKp: number | null;
  minCloud: number | null;
  minTemp: number | null;
  maxWind: number | null;
  maxGust: number | null;
  precip: number | null;
  moon: MoonTonight | null; // phase, % lit, when it's up
};

export type SpotTonight = {
  score: number;
  level: AuroraLevel;
  bestTime: Date | null;
  goodUntil: Date | null;
  cloud: number | null;
  nowLevel: AuroraLevel | null; // the chance in the current hour, null if not in tonight's hours
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

// Sun height in degrees. Uses lib/astro.ts, which handles suncalc 1.x (radians)
// and 2.x (degrees) correctly.
export function sunAltitude(time: Date, lat: number, lon: number): number {
  return sunAltitudeDeg(time, lat, lon);
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

// Cloud cover % → 0..1 (unknown cloud counts as half)
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

// Aurora chance for one hour at one place: activity × sky × darkness × moon
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
    return { score: 0, level: "daylight", kp, sunAltitude: altitude, moon: 1 };
  }

  // Check the moon in the middle of the hour (e.g. 21:30 for the 21:00 row)
  const activity = activityFactor(kp);
  const moon = moonFactor(
    new Date(hour.time.getTime() + ONE_HOUR / 2),
    lat,
    lon,
    activity,
  );

  const score = activity * skyFactor(hour.cloudTotal) * dark * moon;
  return { score, level: levelFromScore(score), kp, sunAltitude: altitude, moon };
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

  const good = pick.best ? rows.filter((r) => r.a.score >= pick.max * 0.9) : [];

  const kps = rows.map((r) => r.a.kp).filter(present);
  const clouds = hours.map((h) => h.cloudTotal).filter(present);
  const temps = hours.map((h) => h.temperature).filter(present);
  const winds = hours.map((h) => h.windSpeed).filter(present);
  const gusts = hours.map((h) => h.windGust).filter(present);
  const precips = hours.map((h) => h.precipitation).filter(present);

  // Moon over the night: first hour → end of the last hour
  const moon = hours.length
    ? moonTonight(
        hours[0].time,
        new Date(hours[hours.length - 1].time.getTime() + ONE_HOUR),
        lat,
        lon,
      )
    : null;

  return {
    level: pick.best ? levelFromScore(pick.max) : "none",
    bestTime: pick.best?.h.time ?? null,
    goodFrom: good[0]?.h.time ?? null,
    goodUntil: good[good.length - 1]?.h.time ?? null,
    symbol: pick.best?.h.symbol ?? hours[0]?.symbol ?? null,
    maxKp: kps.length ? Math.max(...kps) : null,
    minCloud: clouds.length ? Math.min(...clouds) : null,
    minTemp: temps.length ? Math.min(...temps) : null,
    maxWind: winds.length ? Math.max(...winds) : null,
    maxGust: gusts.length ? Math.max(...gusts) : null,
    precip: precips.length ? precips.reduce((sum, p) => sum + p, 0) : null,
    moon,
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
  // Hour score (incl. moon) × light pollution × view north (−15% if blocked)
  const scored = hours.map((h) => ({
    h,
    score:
      auroraForHour(h, kpPoints, spot.lat, spot.lon).score *
      lightFactor[spot.darkness] *
      (spot.viewNorth ? 1 : 0.85),
  }));

  // The hour we're in right now (MET hours start on the hour)
  const now = Date.now();
  const current = scored.find(
    (s) => now >= s.h.time.getTime() && now < s.h.time.getTime() + ONE_HOUR,
  );
  const nowLevel = current ? levelFromScore(current.score) : null;

  const pick = pickBest(scored, (s) => s.score);
  if (!pick.best)
    return {
      score: 0,
      level: "none",
      bestTime: null,
      goodUntil: null,
      cloud: null,
      nowLevel,
    };

  return {
    score: pick.max,
    level: levelFromScore(pick.max),
    bestTime: pick.best.h.time,
    goodUntil: pick.last?.h.time ?? null,
    cloud: pick.best.h.cloudTotal,
    nowLevel,
  };
}