/**
 * TEST ONLY: fake aurora bands for checking how the map glow looks,
 * without waiting for a real aurora night.
 *
 * Use it by adding ?glowTest=<name> to the tonight page URL, e.g.
 *   http://localhost:3000/tonight/bodo?glowTest=storm
 *
 * Only works in development (npm run dev). In production the parameter is
 * ignored, so this file is safe to keep in the project.
 */

import type { AuroraPoint, Box } from "@/lib/sources/ovation";

/**
 * Builds a fake aurora band shaped like a real one.
 * @param centerLat where the band is strongest (degrees north)
 * @param peak      OVATION value in the middle of the band (0–100)
 * @param width     how wide the band is (degrees of latitude)
 */
export function fakeBand(
  box: Box,
  centerLat: number,
  peak: number,
  width = 2,
): AuroraPoint[] {
  const points: AuroraPoint[] = [];
  for (let lat = box.south; lat <= box.north; lat += 0.25) {
    for (let lon = Math.ceil(box.west); lon <= box.east; lon++) {
      // Real ovals sit a bit further south towards the east (Finland/Russia)
      const center = centerLat - lon * 0.04;
      // Bell curve: strongest at the center, fading out north and south
      const value = Math.round(peak * Math.exp(-(((lat - center) / width) ** 2)));
      if (value >= 3) points.push({ lat, lon, value });
    }
  }
  return points;
}

/** Ready-made scenarios: [centerLat, peak, width] */
export const GLOW_TESTS = {
  quiet: [71, 15, 2], // faint band far north (Tromsø/Finnmark), almost nothing at Bodø
  normal: [69.5, 30, 2], // Kp 2–3: soft green over Lofoten/Tromsø
  good: [68, 45, 2], // Kp 3–4: bright green over Bodø and Lofoten
  strong: [66.5, 70, 2.5], // Kp 5: wide bright band, Bodø in the middle
  storm: [67, 100, 3], // Kp 7+: pink core over Bodø
  narrow: [68, 60, 1], // thin sharp band → checks for stripes/blobs
  faint: [68, 12, 4], // weak and wide → checks the low end is still visible
} as const;

export type GlowTestName = keyof typeof GLOW_TESTS;

/** Returns fake points if `name` is a valid test AND we're in development, otherwise null */
export function glowTest(name: string | undefined, box: Box): AuroraPoint[] | null {
  if (process.env.NODE_ENV === "production") return null;
  if (!name || !(name in GLOW_TESTS)) return null;
  const [centerLat, peak, width] = GLOW_TESTS[name as GlowTestName];
  return fakeBand(box, centerLat, peak, width);
}