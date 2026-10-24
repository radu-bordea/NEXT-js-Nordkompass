/**
 * Aurora glow image for the map
 *
 * Instead of a heatmap (where colors depend on how many points overlap at the
 * current zoom), we paint our own picture: every pixel gets a color from the
 * OVATION value at that place. So the colors always mean the same thing:
 *
 *   value  0–2   → transparent (nothing)
 *   value  3–20  → faint → soft green      (weak / normal night)
 *   value 20–45  → green → bright green    (good night)
 *   value 45–50  → bright mint             (strong)
 *   value 50–62  → mint blends into pink
 *   value 62+    → pink                    (storm)
 *
 * Pink starts at 50 on purpose: that's the same OVATION value where a spot's
 * pulse turns into "storm" (STORM_CHANCE in lib/aurora-live.ts), so pink
 * always means the same thing on the whole map.
 *
 * The image is then placed on the map between the corners of GLOW_BOX.
 *
 * Used by:
 *   - page.tsx        → GLOW_BOX (which area to cut out of the OVATION grid)
 *   - spots-map.tsx   → buildGlowImage() (runs in the browser, needs <canvas>)
 */

import type { AuroraPoint, Box } from "@/lib/sources/ovation";

// Area cut out of the OVATION grid. Much bigger than the "Show region" view,
// and the image fades out towards its edges, so you never see a hard border.
// West is negative (= west of Greenwich).
export const GLOW_BOX: Box = { south: 58, north: 78, west: -15, east: 50 };

// Grid spacing of the points we receive (ovation.points() and the test bands)
const LAT_STEP = 0.25;
const LON_STEP = 1;

// Image size in pixels. MapLibre stretches it smoothly, so this is plenty.
const WIDTH = 520;
const HEIGHT = 520;

// How many degrees the glow takes to fade out at the edges of the box
const EDGE_FADE_DEG = 6;

// ---------- colors ----------

/** [value, red, green, blue, alpha 0–1] – colors in between are blended */
type Stop = [number, number, number, number, number];

const DARK_STOPS: Stop[] = [
  [0, 16, 185, 129, 0],
  [3, 16, 185, 129, 0.06], // faint haze
  [10, 16, 185, 129, 0.13],
  [25, 16, 185, 129, 0.2], // normal night
  [45, 52, 211, 153, 0.27], // good night
  [50, 110, 231, 183, 0.3], // strong (storm threshold)
  [55, 170, 140, 220, 0.33], // blending towards pink
  [62, 217, 70, 239, 0.37], // storm (pink)
  [100, 217, 70, 239, 0.42], // big storm: a bit stronger
];

// Light map: deeper green so it shows on light grey
const LIGHT_STOPS: Stop[] = [
  [0, 5, 150, 105, 0],
  [3, 5, 150, 105, 0.08],
  [10, 5, 150, 105, 0.15],
  [25, 5, 150, 105, 0.23],
  [45, 16, 185, 129, 0.3],
  [50, 5, 150, 105, 0.33], // strong (storm threshold)
  [55, 120, 90, 180, 0.35], // blending towards pink
  [62, 192, 38, 211, 0.38], // storm (pink)
  [100, 192, 38, 211, 0.42],
];

/** OVATION value → [r, g, b, a] by blending between the two nearest stops */
function colorFor(
  value: number,
  stops: Stop[],
): [number, number, number, number] {
  if (value <= stops[0][0])
    return [stops[0][1], stops[0][2], stops[0][3], stops[0][4]];
  for (let i = 1; i < stops.length; i++) {
    const [v1, r1, g1, b1, a1] = stops[i];
    if (value <= v1) {
      const [v0, r0, g0, b0, a0] = stops[i - 1];
      const f = (value - v0) / (v1 - v0);
      return [
        r0 + (r1 - r0) * f,
        g0 + (g1 - g0) * f,
        b0 + (b1 - b0) * f,
        a0 + (a1 - a0) * f,
      ];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3], last[4]];
}

// ---------- map projection ----------
// Web maps use the "Mercator" projection: latitudes get stretched further north.
// The image must use the same stretching, otherwise the band would sit too far
// south. So each image row is a step in Mercator-Y, not in latitude.

const mercY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latFromMercY = (y: number) =>
  ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

// ---------- build the image ----------

/** Corners of the image on the map: top-left, top-right, bottom-right, bottom-left */
export const GLOW_COORDINATES: [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] = [
  [GLOW_BOX.west, GLOW_BOX.north],
  [GLOW_BOX.east, GLOW_BOX.north],
  [GLOW_BOX.east, GLOW_BOX.south],
  [GLOW_BOX.west, GLOW_BOX.south],
];

/**
 * Points → PNG image (as a data URL) for MapLibre's image source.
 * Browser only (uses <canvas>).
 */
export function buildGlowImage(points: AuroraPoint[], dark: boolean): string {
  const { south, north, west, east } = GLOW_BOX;
  const rows = Math.round((north - south) / LAT_STEP) + 1;
  const cols = Math.round((east - west) / LON_STEP) + 1;

  // 1. Put the points into a grid (missing points = 0, they were under the minimum)
  const grid = new Float32Array(rows * cols);
  for (const p of points) {
    const r = Math.round((p.lat - south) / LAT_STEP);
    const c = Math.round((p.lon - west) / LON_STEP);
    if (r >= 0 && r < rows && c >= 0 && c < cols) grid[r * cols + c] = p.value;
  }

  // Value at any position between grid points (blend the 4 neighbours = smooth)
  const sample = (r: number, c: number) => {
    const r0 = Math.max(0, Math.min(rows - 1, Math.floor(r)));
    const c0 = Math.max(0, Math.min(cols - 1, Math.floor(c)));
    const r1 = Math.min(rows - 1, r0 + 1);
    const c1 = Math.min(cols - 1, c0 + 1);
    const fr = Math.max(0, Math.min(1, r - r0));
    const fc = Math.max(0, Math.min(1, c - c0));
    const top = grid[r0 * cols + c0] * (1 - fc) + grid[r0 * cols + c1] * fc;
    const bottom = grid[r1 * cols + c0] * (1 - fc) + grid[r1 * cols + c1] * fc;
    return top * (1 - fr) + bottom * fr;
  };

  // Fade 0 → 1 over EDGE_FADE_DEG degrees from each edge of the box
  const edgeFade = (lat: number, lon: number) => {
    const d = Math.min(lat - south, north - lat, lon - west, east - lon);
    const f = Math.max(0, Math.min(1, d / EDGE_FADE_DEG));
    return f * f * (3 - 2 * f); // smooth curve instead of a straight line
  };

  // 2. Paint every pixel
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(WIDTH, HEIGHT);
  const stops = dark ? DARK_STOPS : LIGHT_STOPS;

  const yTop = mercY(north);
  const yBottom = mercY(south);

  for (let py = 0; py < HEIGHT; py++) {
    // Row → latitude (Mercator-correct)
    const lat = latFromMercY(yTop + ((yBottom - yTop) * (py + 0.5)) / HEIGHT);
    const r = (lat - south) / LAT_STEP;

    for (let px = 0; px < WIDTH; px++) {
      const lon = west + ((east - west) * (px + 0.5)) / WIDTH;
      const c = (lon - west) / LON_STEP;

      const value = sample(r, c);
      const [R, G, B, A] = colorFor(value, stops);
      const i = (py * WIDTH + px) * 4;
      image.data[i] = R;
      image.data[i + 1] = G;
      image.data[i + 2] = B;
      image.data[i + 3] = Math.round(A * edgeFade(lat, lon) * 255);
    }
  }

  ctx.putImageData(image, 0, 0);

  // Soften the steps between 1° squares with a light blur (like a real glow).
  // Browsers without canvas filters just skip the blur, which is fine.
  const soft = document.createElement("canvas");
  soft.width = WIDTH;
  soft.height = HEIGHT;
  const softCtx = soft.getContext("2d")!;
  softCtx.filter = "blur(10px)";
  softCtx.drawImage(canvas, 0, 0);
  return soft.toDataURL("image/png");
}