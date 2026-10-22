import * as SunCalc from "suncalc";
import type { MetHour } from "@/lib/sources/met";
import type { Spot } from "@/lib/locations";
import type { Ovation } from "@/lib/sources/ovation"
import type { SolarWind } from "@/lib/sources/solar-wind";

export type LiveLevel = "high" | "possible" | "low" | "none" | "daylight";
export type LiveStatus = "go" | "maybe" | "wait" | "cloudy" | "daylight";

export type SpotNow = {
  score: number;
  level: LiveLevel;
  status: LiveStatus;
  chance: number;          // OVATION chance visible from the spot (0–100)
  cloud: number | null;    // MET cloud this hour
  strengthening: boolean;  // southward solar wind → may get stronger soon
};

// ---------- factors ----------

/** OVATION chance → 0..1 (tune these with your sighting log) */
function chanceFactor(chance: number) {
  if (chance >= 40) return 1;
  if (chance >= 25) return 0.8;
  if (chance >= 10) return 0.55;
  if (chance >= 3) return 0.25;
  return 0.05;
}

function clearFactor(cloud: number | null) {
  if (cloud === null) return 0.5;
  if (cloud < 20) return 1;
  if (cloud < 40) return 0.75;
  if (cloud < 60) return 0.45;
  if (cloud < 80) return 0.2;
  return 0.05;
}

function darkFactor(sunAltitudeDeg: number) {
  if (sunAltitudeDeg <= -12) return 1;
  if (sunAltitudeDeg <= -6) return 0.5;
  return 0;
}

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

function levelFromScore(score: number): LiveLevel {
  if (score >= 0.6) return "high";
  if (score >= 0.35) return "possible";
  if (score >= 0.15) return "low";
  return "none";
}

// ---------- main ----------

export function currentHour(hours: MetHour[], now = new Date()) {
  const t = now.getTime();
  return (
    hours.find((h) => {
      const start = new Date(h.time).getTime();
      return start <= t && t < start + 60 * 60 * 1000;
    }) ?? null
  );
}

export function spotNow(
  spot: Spot,
  hours: MetHour[],
  ovation: Ovation,
  wind: SolarWind | null,
  now = new Date(),
): SpotNow {
  const sunAlt =
    (SunCalc.getPosition(now, spot.lat, spot.lon).altitude * 180) / Math.PI;
  const dark = darkFactor(sunAlt);
  const cloud = currentHour(hours, now)?.cloudTotal ?? null;
  const chance = ovation.visibleFrom(spot.lat, spot.lon, spot.viewNorth);
  const strengthening = (wind?.bzAvg30 ?? 0) <= -5;

  if (dark === 0) {
    return { score: 0, level: "daylight", status: "daylight", chance, cloud, strengthening };
  }

  const activity = chanceFactor(chance);
  const score = Math.min(
    1,
    activity * clearFactor(cloud) * dark * (LIGHT[spot.darkness] ?? 0.8) * bzBoost(wind),
  );
  const level = levelFromScore(score);

  // Aurora is there but clouds block it → say so instead of just "not now"
  const status: LiveStatus =
    level === "high" ? "go"
    : level === "possible" ? "maybe"
    : cloud !== null && cloud >= 70 && activity >= 0.55 ? "cloudy"
    : "wait";

  return { score, level, status, chance, cloud, strengthening };
}