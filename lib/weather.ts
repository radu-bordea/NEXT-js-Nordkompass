import type { MetHour } from "@/lib/sources/met";

export const TIME_ZONE = "Europe/Oslo";

// The hour (0–23) in Norwegian time for a UTC date
export function osloHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      timeZone: TIME_ZONE,
    }).format(date),
  );
}

// Evening and night hours (18:00–06:00 Norwegian time) in the next 24 hours
export function getTonightHours(hours: MetHour[]): MetHour[] {
  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;

  return hours.filter((h) => {
    const t = h.time.getTime();
    if (t < now - 60 * 60 * 1000 || t > in24h) return false;
    const hour = osloHour(h.time);
    return hour >= 18 || hour <= 6;
  });
}

export type SkyLevel = "clear" | "partly" | "cloudy";

export function skyLevel(cloud: number | null): SkyLevel {
  if (cloud === null) return "cloudy";
  if (cloud < 25) return "clear";
  if (cloud < 70) return "partly";
  return "cloudy";
}