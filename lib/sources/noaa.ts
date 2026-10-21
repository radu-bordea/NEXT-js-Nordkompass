import { z } from "zod";

const KP_FORECAST_URL =
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";

// NOAA sends an array like:
// {"time_tag":"2026-10-21T00:00:00","kp":2.33,"observed":"predicted","noaa_scale":null}
const KpEntry = z.object({
  time_tag: z.string(),
  kp: z.coerce.number(),
  observed: z.string(), // "observed" | "estimated" | "predicted"
  noaa_scale: z.string().nullable().optional(), // e.g. "G1" during storms
});

export type KpPoint = {
  time: Date; // start of a 3-hour block, UTC
  kp: number;
  kind: string;
  scale: string | null;
};

// NOAA's times are UTC but have no "Z" at the end, so we add it
function parseUtc(value: string): Date {
  return new Date(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`);
}

export async function fetchKpForecast(): Promise<KpPoint[]> {
  const res = await fetch(KP_FORECAST_URL, { next: { revalidate: 900 } }); // 15 min

  if (!res.ok) {
    throw new Error(`NOAA request failed: ${res.status} ${res.statusText}`);
  }

  const data = z.array(KpEntry).parse(await res.json());

  return data.map((e) => ({
    time: parseUtc(e.time_tag),
    kp: e.kp,
    kind: e.observed,
    scale: e.noaa_scale ?? null,
  }));
}