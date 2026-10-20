import { z } from "zod";

// What we read from each hour in MET's response
const Details = z.object({
  cloud_area_fraction: z.number().optional(),
  cloud_area_fraction_low: z.number().optional(),
  cloud_area_fraction_medium: z.number().optional(),
  cloud_area_fraction_high: z.number().optional(),
  air_temperature: z.number().optional(),
  wind_speed: z.number().optional(),
});

const MetResponse = z.object({
  properties: z.object({
    timeseries: z.array(
      z.object({
        time: z.string(),
        data: z.object({
          instant: z.object({ details: Details }),
        }),
      }),
    ),
  }),
});

export type MetHour = {
  time: Date;
  cloudTotal: number | null;
  cloudLow: number | null;
  cloudMedium: number | null;
  cloudHigh: number | null;
  temperature: number | null;
  windSpeed: number | null;
};

export async function fetchMetForecast(lat: number, lon: number): Promise<MetHour[]> {
  const userAgent = process.env.MET_USER_AGENT;
  if (!userAgent) {
    throw new Error("MET_USER_AGENT is missing in .env");
  }

  // MET asks for max 4 decimals in coordinates
  const url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;

  const res = await fetch(url, {
    headers: { "User-Agent": userAgent },
    next: { revalidate: 1800 }, // reuse the answer for 30 minutes
  });

  if (!res.ok) {
    throw new Error(`MET request failed: ${res.status} ${res.statusText}`);
  }

  const json = MetResponse.parse(await res.json());

  return json.properties.timeseries.map((t) => {
    const d = t.data.instant.details;
    return {
      time: new Date(t.time), // UTC
      cloudTotal: d.cloud_area_fraction ?? null,
      cloudLow: d.cloud_area_fraction_low ?? null,
      cloudMedium: d.cloud_area_fraction_medium ?? null,
      cloudHigh: d.cloud_area_fraction_high ?? null,
      temperature: d.air_temperature ?? null,
      windSpeed: d.wind_speed ?? null,
    };
  });
}