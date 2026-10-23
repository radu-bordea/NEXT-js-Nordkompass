/**
 * GET /api/now?lat=67.28&lon=14.55
 *
 * "Right now" for ANY position (used by the "Check my location" button).
 * Same live calculation as the spots (lib/aurora-live.ts):
 *   OVATION aurora chance × MET cloud × darkness × light × moon × solar wind
 *
 * Privacy + caching: the position is rounded to 2 decimals (~1 km) before
 * use. We don't store it anywhere. Rounding also means nearby visitors share
 * the same cached MET forecast instead of each causing a new MET request.
 *
 * Only positions in our region are accepted (protects MET from random calls).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchMetForecast } from "@/lib/sources/met";
import { fetchOvation } from "@/lib/sources/ovation";
import { fetchSolarWind } from "@/lib/sources/solar-wind";
import { spotNow, pulseFor } from "@/lib/aurora-live";
import type { Spot } from "@/lib/locations";

// Northern Europe box: Trøndelag/Sweden/Finland up to Svalbard's south
const Query = z.object({
  lat: z.coerce.number().min(58).max(75),
  lon: z.coerce.number().min(-10).max(40),
});

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = Query.safeParse({
    lat: params.get("lat"),
    lon: params.get("lon"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "outside" }, { status: 400 });
  }

  const lat = round2(parsed.data.lat);
  const lon = round2(parsed.data.lon);

  const [metResult, ovationResult, windResult] = await Promise.allSettled([
    fetchMetForecast(lat, lon),
    fetchOvation(),
    fetchSolarWind(),
  ]);

  // Without OVATION there is no live answer
  if (ovationResult.status === "rejected") {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  // Treat the visitor's position like a spot. We don't know how dark it is
  // there, so assume "some light around" (darkness 3, like a village).
  const here = {
    slug: "my-location",
    name: "",
    lat,
    lon,
    darkness: 3,
    viewNorth: true,
    note: { en: "", no: "" },
    verified: false,
  } as Spot;

  const result = spotNow(
    here,
    metResult.status === "fulfilled" ? metResult.value : [],
    ovationResult.value,
    windResult.status === "fulfilled" ? windResult.value : null,
  );

  return NextResponse.json(
    {
      lat,
      lon,
      status: result.status,
      pulse: pulseFor(result.status),
      chance: result.chance,
      cloud: result.cloud,
      strengthening: result.strengthening,
    },
    { headers: { "Cache-Control": "no-store" } }, // always fresh, never cached by browsers
  );
}