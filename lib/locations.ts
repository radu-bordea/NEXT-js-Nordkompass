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
    spots: [],
  },
} satisfies Record<string, Area>;

export type LocationSlug = keyof typeof locations;

export function getLocation(slug: string): Area | null {
  return slug in locations ? locations[slug as LocationSlug] : null;
}