/**
 * Step 2: "RIGHT NOW" score for one spot (live)
 *
 * score = aurora chance × clear sky × darkness × spot light × moon × solar wind boost
 *
 *   aurora chance   NOAA OVATION, what's visible from the spot (overhead or low north)
 *   clear sky       MET cloud cover this hour at the spot
 *   darkness        sun below −12° = fully dark, −6° to −12° = half, above = daylight
 *   spot light      light pollution (darkness rating 1–5 in locations.ts)
 *   moon            bright moon hides weak aurora a bit (lib/moon.ts, max −15%)
 *   solar wind      southward Bz (negative) = aurora may get stronger soon
 *
 * Result → level (high/possible/low/none) → status shown to users:
 *   storm    "Strong aurora — go out now!" (high + very strong aurora → pink, fast pulse)
 *   go       "Go out now"                  (level high → green pulse, 3 waves)
 *   maybe    "Maybe — worth a look"        (level possible → blue pulse, 1 slow ring)
 *   cloudy   "Aurora active, but too cloudy"
 *   wait     "Not now"
 *   daylight "Too bright — wait for darkness"
 */

import { sunAltitudeDeg } from "@/lib/astro";
import type { MetHour } from "@/lib/sources/met";
import type { Spot } from "@/lib/locations";
import type { Ovation } from "@/lib/sources/ovation";
import type { SolarWind } from "@/lib/sources/solar-wind";
import { moonFactor } from "@/lib/moon";

export type LiveLevel = "high" | "possible" | "low" | "none" | "daylight";
export type LiveStatus = "storm" | "go" | "maybe" | "wait" | "cloudy" | "daylight";

/** How a spot pulses on the map (null = no pulse) */
export type PulseLevel = "maybe" | "go" | "storm" | null;

/** Status → pulse. Only statuses where going out makes sense pulse. */
export function pulseFor(status: LiveStatus | null | undefined): PulseLevel {
  if (status === "storm" || status === "go" || status === "maybe") return status;
  return null;
}

// "Storm": the spot is already "Go" AND the aurora itself is very strong:
// OVATION 50+ at the spot, or strongly southward solar wind (Bz ≤ −10).
const STORM_CHANCE = 50;
const STORM_BZ = -10;

export type SpotNow = {
  score: number; // 0–1
  level: LiveLevel;
  status: LiveStatus;
  chance: number; // OVATION chance visible from the spot (0–100)
  cloud: number | null; // MET cloud this hour (%)
  strengthening: boolean; // southward solar wind → may get stronger soon
};

// ======================================================================
// FACTORS (each 0–1, multiplied together)
// ======================================================================

/** OVATION chance → 0..1 (tune these with your sighting log) */
function chanceFactor(chance: number) {
  if (chance >= 40) return 1;
  if (chance >= 25) return 0.8;
  if (chance >= 10) return 0.55;
  if (chance >= 3) return 0.25;
  return 0.05;
}

/** Cloud cover % → 0..1 (unknown cloud counts as half) */
function clearFactor(cloud: number | null) {
  if (cloud === null) return 0.5;
  if (cloud < 20) return 1;
  if (cloud < 40) return 0.75;
  if (cloud < 60) return 0.45;
  if (cloud < 80) return 0.2;
  return 0.05;
}

/** Sun height → 0..1 (0 = daylight, aurora not visible at all) */
function darkFactor(sunAltitudeDeg: number) {
  if (sunAltitudeDeg <= -12) return 1; // nautical night: fully dark
  if (sunAltitudeDeg <= -6) return 0.5; // nautical twilight: half
  return 0;
}

/** Spot darkness rating 1–5 → 0..1 (5 = no light pollution) */
const LIGHT: Record<number, number> = { 1: 0.6, 2: 0.75, 3: 0.85, 4: 0.95, 5: 1 };

/** Southward Bz (negative) feeds the aurora; northward calms it */
function bzBoost(wind: SolarWind | null) {
  const bz = wind?.bzAvg30;
  if (bz === null || bz === undefined) return 1;
  if (bz <= -10) return 1.25;
  if (bz <= -5) return 1.1;
  if (bz >= 5) return 0.85;
  return 1;
}

/** Score → level (same thresholds as step 1) */
function levelFromScore(score: number): LiveLevel {
  if (score >= 0.6) return "high";
  if (score >= 0.35) return "possible";
  if (score >= 0.15) return "low";
  return "none";
}

// ======================================================================
// MAIN
// ======================================================================

/** The MET hour that contains `now` (e.g. 21:00 for 21:37) */
export function currentHour(hours: MetHour[], now = new Date()) {
  const t = now.getTime();
  return (
    hours.find((h) => {
      const start = new Date(h.time).getTime();
      return start <= t && t < start + 60 * 60 * 1000;
    }) ?? null
  );
}

/** Live "right now" result for one spot */
export function spotNow(
  spot: Spot,
  hours: MetHour[],
  ovation: Ovation,
  wind: SolarWind | null,
  now = new Date(),
): SpotNow {
  const sunAlt = sunAltitudeDeg(now, spot.lat, spot.lon);
  const dark = darkFactor(sunAlt);
  const cloud = currentHour(hours, now)?.cloudTotal ?? null;
  const chance = ovation.visibleFrom(spot.lat, spot.lon, spot.viewNorth);
  const strengthening = (wind?.bzAvg30 ?? 0) <= -5;

  // Daylight: nothing else matters
  if (dark === 0) {
    return { score: 0, level: "daylight", status: "daylight", chance, cloud, strengthening };
  }

  const activity = chanceFactor(chance);
  const moon = moonFactor(now, spot.lat, spot.lon, activity);

  const score = Math.min(
    1,
    activity *
      clearFactor(cloud) *
      dark *
      (LIGHT[spot.darkness] ?? 0.8) *
      moon *
      bzBoost(wind),
  );
  const level = levelFromScore(score);

  // Very strong aurora at a "Go" spot → storm
  const veryStrong =
    chance >= STORM_CHANCE || (wind?.bzAvg30 ?? 0) <= STORM_BZ;

  // Aurora is there but clouds block it → say so instead of just "not now"
  const status: LiveStatus =
    level === "high" ? (veryStrong ? "storm" : "go")
    : level === "possible" ? "maybe"
    : cloud !== null && cloud >= 70 && activity >= 0.55 ? "cloudy"
    : "wait";

  return { score, level, status, chance, cloud, strengthening };
}