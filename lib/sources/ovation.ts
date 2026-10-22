/**
 * NOAA OVATION aurora model (step 2, live)
 *
 * NOAA publishes a grid covering the whole Earth: one value per 1° lat × 1° lon
 * square (360 × 181 = ~65,000 squares). Each value (0–100) is the chance of
 * aurora overhead in the next ~30–90 minutes. Updated about every 5 minutes.
 *
 * File format:
 *   {
 *     "Observation Time": "2026-10-22T09:30:00Z",
 *     "Forecast Time":    "2026-10-22T10:31:00Z",
 *     "coordinates": [[lon, lat, value], ...]   // lon 0..359, lat -90..90
 *   }
 *
 * We use it for:
 *   - at()          → raw value in one square
 *   - visibleFrom() → what you can SEE from a spot (overhead or low in the north)
 *   - points()      → a cut-out of the grid for the green glow on the map
 */

import { z } from "zod";

const OVATION_URL =
  "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";

const OvationSchema = z.object({
  "Observation Time": z.string(),
  "Forecast Time": z.string(),
  coordinates: z.array(z.tuple([z.number(), z.number(), z.number()])), // [lon, lat, value]
});

/** One point of the glow layer on the map */
export type AuroraPoint = { lat: number; lon: number; value: number };

/** Area to cut out of the global grid (degrees). West can be negative. */
export type Box = { south: number; north: number; west: number; east: number };

export type Ovation = {
  observed: Date; // when NOAA measured the input data
  forecast: Date; // the time the values are valid for (~30–90 min later)
  /** Raw OVATION value (0–100) in the 1°×1° square at this point */
  at: (lat: number, lon: number) => number;
  /** What you can see from here: aurora overhead, or a bit further north low on the horizon */
  visibleFrom: (lat: number, lon: number, viewNorth?: boolean) => number;
  /** Cut-out of the grid for the map glow (values ≥ min, extra rows every latStep°) */
  points: (box: Box, min?: number, latStep?: number) => AuroraPoint[];
};

const COLS = 360; // lon 0..359
const ROWS = 181; // lat -90..90

// Aurora 1–4° further north (~110–450 km) can still be seen over the northern
// horizon, but lower and weaker, so it counts less the further away it is.
const NORTH_WEIGHTS = [0.85, 0.7, 0.55, 0.4];

/** NOAA times sometimes lack the "Z" → force UTC */
function utc(value: string) {
  return new Date(/Z$|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
}

/** lat/lon → position in our flat grid array. Handles negative lon (e.g. -10 → 350). */
function index(lat: number, lon: number) {
  const la = Math.min(90, Math.max(-90, Math.round(lat)));
  const lo = ((Math.round(lon) % 360) + 360) % 360;
  return (la + 90) * COLS + lo;
}

// Parse the big grid only once per NOAA update (same "Forecast Time" = same data)
let memo: { key: string; data: Ovation } | null = null;

export async function fetchOvation(): Promise<Ovation> {
  // Cached by Next for 5 min (NOAA updates about that often)
  const res = await fetch(OVATION_URL, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`OVATION request failed: ${res.status}`);

  const json = OvationSchema.parse(await res.json());
  const key = json["Forecast Time"];
  if (memo?.key === key) return memo.data;

  // Store all 65,000 values in a compact byte array (0–100 fits in one byte)
  const grid = new Uint8Array(COLS * ROWS);
  for (const [lon, lat, value] of json.coordinates) {
    grid[index(lat, lon)] = Math.min(100, Math.max(0, Math.round(value)));
  }

  const at = (lat: number, lon: number) => grid[index(lat, lon)];

  // Best of: aurora overhead, or (weighted) aurora 1–4° further north
  const visibleFrom = (lat: number, lon: number, viewNorth = true) => {
    let best = at(lat, lon);
    if (!viewNorth) return best; // spot has mountains to the north → only overhead counts
    NORTH_WEIGHTS.forEach((weight, i) => {
      best = Math.max(best, Math.round(at(lat + i + 1, lon) * weight));
    });
    return best;
  };

  // Cut out only our region and fill in extra rows between whole degrees.
  // Why: on the map, 1° of latitude up here is ~2.7× taller than 1° of longitude,
  // so raw 1° points would show as horizontal stripes. We add rows every 0.25°
  // (blending the value of the degree below and above) so the glow is smooth.
  // Points under `min` are skipped: invisible anyway, and less data to send.
  const points = (box: Box, min = 3, latStep = 0.25): AuroraPoint[] => {
    const result: AuroraPoint[] = [];
    for (let lat = box.south; lat <= box.north; lat += latStep) {
      const below = Math.floor(lat);
      const above = below + 1;
      const f = lat - below; // 0 at the lower degree, → 1 towards the upper one
      for (let lon = Math.ceil(box.west); lon <= box.east; lon++) {
        const value = at(below, lon) * (1 - f) + at(above, lon) * f;
        if (value >= min) {
          result.push({
            lat: Math.round(lat * 100) / 100,
            lon,
            value: Math.round(value),
          });
        }
      }
    }
    return result;
  };

  const data: Ovation = {
    observed: utc(json["Observation Time"]),
    forecast: utc(key),
    at,
    visibleFrom,
    points,
  };
  memo = { key, data };
  return data;
}