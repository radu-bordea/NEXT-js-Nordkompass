/**
 * Areas and spots from the DATABASE (Neon, via Prisma).
 *
 * Replaces reading lib/locations.ts directly. lib/locations.ts is now only
 * the source for the seed script (npm run db:seed) and holds the shared
 * Spot/Area types.
 *
 * The functions return the SAME shape as lib/locations.ts used to, so the
 * map, pulses, "Right now", forecast etc. didn't need to change.
 *
 * Only PUBLIC spots are returned here (organizationId = null). A business's
 * own spots will get their own functions later (screen, widget, dashboard).
 *
 * `cache()` from React: if several parts of one page ask for the same area
 * (page + metadata + picker), the database is only asked once per request.
 */

import { cache } from "react";
import prisma from "@/lib/prisma";
import type { Area, Spot } from "@/lib/locations";

/** One area with its public spots, or null if the slug doesn't exist */
export const getArea = cache(async (slug: string): Promise<Area | null> => {
  const area = await prisma.area.findUnique({
    where: { slug },
    include: {
      spots: {
        where: { organizationId: null }, // public spots only
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!area) return null;

  return {
    name: area.name,
    lat: area.lat,
    lon: area.lon,
    spots: area.spots.map(
      (s): Spot => ({
        slug: s.slug,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        darkness: s.darkness as Spot["darkness"], // 1–5 in the database
        viewNorth: s.viewNorth,
        note: { en: s.noteEn, no: s.noteNo },
        verified: s.verified,
      }),
    ),
  };
});

/** All areas (slug + name) in menu order – for the area picker and home page */
export const listAreas = cache(async () => {
  return prisma.area.findMany({
    select: { slug: true, name: true },
    orderBy: { sortOrder: "asc" },
  });
});