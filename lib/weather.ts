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

// Date in Norwegian time as "YYYY-MM-DD"
export function osloDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isNightHour(date: Date): boolean {
  const hour = osloHour(date);
  return hour >= 18 || hour <= 6;
}

// Group forecast hours into nights (18:00–06:00 Norwegian time)
export function groupNights(hours: MetHour[], count = 3): { key: string; hours: MetHour[] }[] {
  const now = Date.now();
  const nights = new Map<string, MetHour[]>();

  for (const h of hours) {
    if (h.time.getTime() < now - 60 * 60 * 1000) continue; // skip the past
    if (!isNightHour(h.time)) continue;

    // Minus 12 hours: 18:00–23:00 stays on the same date, 00:00–06:00 moves to the evening before
    const key = osloDateKey(new Date(h.time.getTime() - 12 * 60 * 60 * 1000));
    const list = nights.get(key) ?? [];
    list.push(h);
    nights.set(key, list);
  }

  return [...nights.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, count)
    .map(([key, hours]) => ({ key, hours }));
}