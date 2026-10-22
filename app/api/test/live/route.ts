import { NextResponse } from "next/server";
import { fetchOvation } from "@/lib/sources/ovation"
import { fetchSolarWind } from "@/lib/sources/solar-wind";
import { getLocation } from "@/lib/locations";

export async function GET() {
  const area = getLocation("bodo");
  const [ov, sw] = await Promise.allSettled([fetchOvation(), fetchSolarWind()]);

  const ovation =
    ov.status === "fulfilled"
      ? {
          observed: ov.value.observed,
          forecast: ov.value.forecast,
          spots: area?.spots.map((s) => ({
            name: s.name,
            overhead: ov.value.at(s.lat, s.lon),
            visible: ov.value.visibleFrom(s.lat, s.lon, s.viewNorth),
          })),
          lofoten: ov.value.at(68.23, 14.57),
          tromso: ov.value.at(69.65, 18.96),
        }
      : { error: String(ov.reason) };

  const solarWind =
    sw.status === "fulfilled" ? sw.value : { error: String(sw.reason) };

  return NextResponse.json({ ovation, solarWind });
}