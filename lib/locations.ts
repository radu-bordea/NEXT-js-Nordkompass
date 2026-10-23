/**
 * Areas and viewing spots
 *
 * An AREA is a place in the menu (Bodø, Svolvær …). Its lat/lon is used for
 * the hour-by-hour weather table and the moon.
 * A SPOT is a concrete place to watch from. Each spot gets its own MET weather,
 * its own live "right now" status, a numbered dot on the map and a pulse.
 *
 * darkness:  1 = city lights … 5 = no artificial light at all
 * viewNorth: true if nothing (mountains, buildings) blocks the northern sky
 * verified:  set to true once someone has checked the spot on location
 *
 * Later (database step) these move into the database so businesses can add
 * their own spots from the dashboard.
 */

export type Spot = {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  darkness: 1 | 2 | 3 | 4 | 5; // 1 = city lights, 5 = very dark
  viewNorth: boolean; // open view towards the northern sky
  note: { en: string; no: string };
  verified: boolean; // set to true when you've checked the coordinates
};

export type Area = {
  name: string;
  lat: number; // used for the area's weather forecast
  lon: number;
  spots: Spot[];
};

export const locations = {
  bodo: {
    name: "Bodø",
    lat: 67.2804,
    lon: 14.4049,
    spots: [
      {
        slug: "turisthytta",
        name: "Turisthytta (Rønvikfjellet)",
        lat: 67.295, // approximate, verify
        lon: 14.414,
        darkness: 2,
        viewNorth: true,
        note: {
          en: "Panoramic view over the city and north towards the sea. Some city light.",
          no: "Panoramautsikt over byen og nordover mot havet. Noe lys fra byen.",
        },
        verified: false,
      },
      {
        slug: "lopsstranden",
        name: "Løpsstranden",
        lat: 67.307, // approximate, verify
        lon: 14.463,
        darkness: 3,
        viewNorth: true,
        note: {
          en: "Beach with an open view across the sea to the north. Close to town.",
          no: "Strand med åpen utsikt over havet mot nord. Nær byen.",
        },
        verified: false,
      },
      {
        slug: "mjelle",
        name: "Mjelle",
        lat: 67.388, // approximate, verify
        lon: 14.744,
        darkness: 4,
        viewNorth: true,
        note: {
          en: "Dark beach north of Bodø with an open view towards the sea.",
          no: "Mørk strand nord for Bodø med åpen utsikt mot havet.",
        },
        verified: false,
      },
      {
        // Test spot: measured with "My location" on 23 Oct 2026
        slug: "alstad",
        name: "Alstad",
        lat: 67.2743,
        lon: 14.4574,
        darkness: 2, // residential area: street lights nearby
        viewNorth: true, // change to false if houses/hills block the north
        note: {
          en: "Residential area on the edge of Bodø. Handy for a quick look, but street lights hide weak aurora.",
          no: "Boligområde i utkanten av Bodø. Fint for en rask titt, men gatelys skjuler svakt nordlys.",
        },
        verified: true,
      },
    ],
  },
  kjerringoy: {
    name: "Kjerringøy",
    lat: 67.5194,
    lon: 14.7617,
    spots: [
      {
        slug: "kjerringoy-handelssted",
        name: "Kjerringøy handelssted",
        lat: 67.5194, // approximate, verify
        lon: 14.7617,
        darkness: 5,
        viewNorth: true,
        note: {
          en: "Historic trading post with almost no light pollution.",
          no: "Historisk handelssted med nesten ingen lysforurensning.",
        },
        verified: false,
      },
    ],
  },
  saltstraumen: {
    name: "Saltstraumen",
    lat: 67.2333,
    lon: 14.6167,
    spots: [
      {
        slug: "saltstraumen-bridge",
        name: "Saltstraumen bridge",
        lat: 67.2333, // approximate, verify
        lon: 14.6167,
        darkness: 3,
        viewNorth: true,
        note: {
          en: "The world's strongest tidal current. A dramatic foreground for photos.",
          no: "Verdens sterkeste tidevannsstrøm. Dramatisk forgrunn for bilder.",
        },
        verified: false,
      },
    ],
  },
  sandhornoya: {
    name: "Sandhornøya",
    lat: 67.105, // approximate, verify
    lon: 14.13,
    spots: [
      {
        slug: "langsanden",
        name: "Langsanden",
        lat: 67.105, // approximate, verify
        lon: 14.13,
        darkness: 5,
        viewNorth: true,
        note: {
          en: "Long beach with an open view north and very little artificial light.",
          no: "Lang strand med åpen utsikt mot nord og svært lite kunstig lys.",
        },
        verified: false,
      },
    ],
  },
  svolvaer: {
    name: "Svolvær",
    lat: 68.2342,
    lon: 14.5683,
    spots: [
      {
        // Village on the north coast of Austvågøya, ~25 min drive from Svolvær
        slug: "laukvik",
        name: "Laukvik",
        lat: 68.3881, // village centre (Wikipedia), verify the exact viewing place
        lon: 14.4177,
        darkness: 5,
        viewNorth: true,
        note: {
          en: "Small village on the north coast, facing the open sea to the north. Known for aurora watching.",
          no: "Lite fiskevær på nordsiden, med åpent hav mot nord. Kjent for nordlys.",
        },
        verified: false,
      },
      {
        // Peninsula in Austnesfjorden with the famous little chapel, ~15 min from Svolvær
        slug: "sildpollneset",
        name: "Sildpollneset",
        lat: 68.3222, // peninsula (Wikipedia), the chapel is at its tip; verify
        lon: 14.7172,
        darkness: 4,
        viewNorth: true, // fjord opens to the north; mountains around, verify
        note: {
          en: "Small chapel on a peninsula in the fjord, a classic photo spot with mountains and water. Parking by the E10.",
          no: "Lite kapell på et nes i fjorden, et klassisk fotomotiv med fjell og vann. Parkering ved E10.",
        },
        verified: false,
      },
      {
        // Flat island west of Svolvær, ~35 min drive
        slug: "gimsoya",
        name: "Gimsøya",
        lat: 68.2918, // island centre (Wikipedia); best views on the north coast near Hov
        lon: 14.1865,
        darkness: 5,
        viewNorth: true,
        note: {
          en: "Flat, open island with wide skies and very little light. Head to the north coast near Hov for the best view.",
          no: "Flat og åpen øy med vid himmel og svært lite lys. Kjør til nordkysten ved Hov for best utsikt.",
        },
        verified: false,
      },
    ],
  },
} satisfies Record<string, Area>;

export type LocationSlug = keyof typeof locations;

export function getLocation(slug: string): Area | null {
  return slug in locations ? locations[slug as LocationSlug] : null;
}