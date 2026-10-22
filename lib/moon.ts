/**
 * Moon: phase, brightness, when it's up, and how much it hides weak aurora.
 *
 * Why it matters: moonlight brightens the sky. Strong aurora is bright enough
 * to see anyway, but weak/medium aurora gets harder to see with a big moon up.
 *
 * All values come from the `suncalc` package (pure astronomy, no API):
 *   - getMoonIllumination(date) → fraction lit (0–1) and phase (0–1)
 *   - moon height via lib/astro.ts (handles suncalc's degrees/radians difference)
 *
 * Importance in our score: clouds > aurora activity > darkness > moon.
 * The moon only fine-tunes (at most −15%), and never touches strong aurora.
 */

import * as SunCalc from "suncalc";
import { moonAltitudeDeg } from "@/lib/astro";

// ======================================================================
// BASICS
// ======================================================================

/** How much of the moon is lit, 0–1 (0 = new moon, 1 = full moon) */
export function moonLit(time: Date) {
  return SunCalc.getMoonIllumination(time).fraction;
}

/** Moon height above the horizon in degrees (negative = below the horizon) */
export function moonAltitude(time: Date, lat: number, lon: number) {
  return moonAltitudeDeg(time, lat, lon);
}

export type MoonPhase =
  | "new"
  | "waxingCrescent"
  | "firstQuarter"
  | "waxingGibbous"
  | "full"
  | "waningGibbous"
  | "lastQuarter"
  | "waningCrescent";

/**
 * Phase name. suncalc's `phase` goes 0 → 1 over one cycle (~29.5 days):
 * 0 new, 0.25 first quarter, 0.5 full, 0.75 last quarter.
 * ±0.03 (about 1 day) counts as "exactly" new/quarter/full.
 */
export function moonPhase(time: Date): MoonPhase {
  const p = SunCalc.getMoonIllumination(time).phase;
  const near = (target: number) => Math.abs(p - target) < 0.03;
  if (near(0) || near(1)) return "new";
  if (near(0.25)) return "firstQuarter";
  if (near(0.5)) return "full";
  if (near(0.75)) return "lastQuarter";
  if (p < 0.25) return "waxingCrescent";
  if (p < 0.5) return "waxingGibbous";
  if (p < 0.75) return "waningGibbous";
  return "waningCrescent";
}

// ======================================================================
// SCORE FACTOR
// ======================================================================

/**
 * Multiplier for the aurora score (0.85–1).
 *
 * penalty = lit × height × 15%
 *   - lit:    0 (new) → 1 (full)
 *   - height: 0 at the horizon → 1 when 20°+ up (a low moon lights the sky less)
 *
 * The penalty is scaled by how weak the aurora is:
 *   - activity ≥ 0.9 (strong)  → no penalty (visible even with a full moon)
 *   - activity ≥ 0.7 (medium)  → half penalty
 *   - weaker                   → full penalty
 *
 * @param activity the aurora activity factor (0–1) used in the score
 */
export function moonFactor(time: Date, lat: number, lon: number, activity: number) {
  const altitude = moonAltitude(time, lat, lon);
  if (altitude <= 0) return 1; // moon below the horizon → no effect

  const height = Math.min(1, altitude / 20);
  const penalty = moonLit(time) * height * 0.15;

  const weakness = activity >= 0.9 ? 0 : activity >= 0.7 ? 0.5 : 1;
  return 1 - penalty * weakness;
}

// ======================================================================
// TONIGHT SUMMARY (for the moon card)
// ======================================================================

export type MoonBrightness = "dark" | "some" | "bright";

export type MoonTonight = {
  phase: MoonPhase;
  lit: number; // 0–100 (%)
  upFrom: Date | null; // first time the moon is up during the night window
  upUntil: Date | null; // last time the moon is up during the night window
  upAllNight: boolean;
  neverUp: boolean;
  brightness: MoonBrightness; // overall effect on the night
};

const STEP_MS = 10 * 60 * 1000; // check every 10 minutes

/**
 * Summarise the moon between `start` and `end` (e.g. 18:00 → 06:00).
 * Instead of suncalc's getMoonTimes (which works per calendar day and is
 * tricky with time zones), we simply check the moon's height every
 * 10 minutes through the night. Simple and always correct for our window.
 */
export function moonTonight(start: Date, end: Date, lat: number, lon: number): MoonTonight {
  const mid = new Date((start.getTime() + end.getTime()) / 2);
  const lit = moonLit(mid);

  let upFrom: Date | null = null;
  let upUntil: Date | null = null;
  let upSteps = 0;
  let totalSteps = 0;

  for (let t = start.getTime(); t <= end.getTime(); t += STEP_MS) {
    totalSteps++;
    if (moonAltitude(new Date(t), lat, lon) > 0) {
      upSteps++;
      if (!upFrom) upFrom = new Date(t);
      upUntil = new Date(t);
    }
  }

  const upShare = totalSteps ? upSteps / totalSteps : 0; // 0–1 of the night

  // Overall brightness: how lit × how long it's up
  const amount = lit * upShare;
  const brightness: MoonBrightness =
    amount < 0.15 ? "dark" : amount < 0.45 ? "some" : "bright";

  return {
    phase: moonPhase(mid),
    lit: Math.round(lit * 100),
    upFrom,
    upUntil,
    upAllNight: upSteps === totalSteps && totalSteps > 0,
    neverUp: upSteps === 0,
    brightness,
  };
}