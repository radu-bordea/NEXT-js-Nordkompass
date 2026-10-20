export const locations = {
  bodo: { name: "Bodø", lat: 67.2804, lon: 14.4049 },
  saltstraumen: { name: "Saltstraumen", lat: 67.2333, lon: 14.6167 },
  kjerringoy: { name: "Kjerringøy", lat: 67.5194, lon: 14.7617 },
  svolvaer: { name: "Svolvær", lat: 68.2342, lon: 14.5683 },
} as const;

export type LocationSlug = keyof typeof locations;

export function getLocation(slug: string) {
  return slug in locations ? locations[slug as LocationSlug] : null;
}