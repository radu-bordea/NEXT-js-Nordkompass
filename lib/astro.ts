/**
 * Sun and moon height above the horizon, in degrees.
 *
 * Why this file exists: the `suncalc` package changed units between versions.
 *   - suncalc 1.x returns altitude in RADIANS (−1.57 … 1.57)
 *   - suncalc 2.x returns altitude in DEGREES (−90 … 90)
 * Mixing them up still gets "sun up vs down" right, but twilight (−6° to −12°)
 * comes out wrong. So we detect the unit once and always return degrees.
 *
 * Use these helpers everywhere instead of calling suncalc's altitude directly.
 */

import * as SunCalc from "suncalc";

// Detect the unit: at the equator around noon on the March equinox the sun is
// almost straight overhead (~90°). In radians that's ~1.57, in degrees ~89.
const PROBE = SunCalc.getPosition(new Date("2024-03-20T12:07:00Z"), 0, 0).altitude;
const RETURNS_DEGREES = Math.abs(PROBE) > 2;

function toDegrees(value: number) {
  return RETURNS_DEGREES ? value : (value * 180) / Math.PI;
}

/** Sun height in degrees (negative = below the horizon). −12° or lower = dark. */
export function sunAltitudeDeg(time: Date, lat: number, lon: number) {
  return toDegrees(SunCalc.getPosition(time, lat, lon).altitude);
}

/** Moon height in degrees (negative = below the horizon) */
export function moonAltitudeDeg(time: Date, lat: number, lon: number) {
  return toDegrees(SunCalc.getMoonPosition(time, lat, lon).altitude);
}