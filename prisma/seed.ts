// Seed: copies all areas and public spots from lib/locations.ts into the
// database, and creates your own test organization.
//
// Run with:  npm run db:seed
//
// Safe to run again: it uses "upsert" (update if it exists, create if not),
// so you never get duplicates. Run it on dev first, production once later.
import "dotenv/config";
import prisma from "../lib/prisma";
import { locations } from "../lib/locations";

async function main() {
  let areaOrder = 0;

  for (const [slug, area] of Object.entries(locations)) {
    // 1. The area (Bodø, Svolvær …)
    const savedArea = await prisma.area.upsert({
      where: { slug },
      update: { name: area.name, lat: area.lat, lon: area.lon, sortOrder: areaOrder },
      create: { slug, name: area.name, lat: area.lat, lon: area.lon, sortOrder: areaOrder },
    });
    areaOrder++;

    // 2. Its public spots (organizationId stays null = public)
    let spotOrder = 0;
    for (const spot of area.spots) {
      const data = {
        name: spot.name,
        lat: spot.lat,
        lon: spot.lon,
        darkness: spot.darkness,
        viewNorth: spot.viewNorth,
        noteEn: spot.note.en,
        noteNo: spot.note.no,
        verified: spot.verified,
        sortOrder: spotOrder,
      };
      await prisma.spot.upsert({
        where: { areaId_slug: { areaId: savedArea.id, slug: spot.slug } },
        update: data,
        create: { ...data, slug: spot.slug, areaId: savedArea.id },
      });
      spotOrder++;
    }

    console.log(`✓ ${area.name}: ${area.spots.length} spots`);
  }

  // 3. Your own test organization (home TV + laptops), full access as a pilot
  await prisma.organization.upsert({
    where: { slug: "nordkompass-test" },
    update: {},
    create: {
      name: "Nordkompass Test",
      slug: "nordkompass-test",
      plan: "HOTEL",
      pilotUntil: new Date("2027-12-31"),
    },
  });
  console.log("✓ Organization: Nordkompass Test (pilot)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());