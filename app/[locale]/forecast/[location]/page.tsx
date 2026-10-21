import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { fetchMetForecast, type MetHour } from "@/lib/sources/met";
import { fetchKpForecast, type KpPoint } from "@/lib/sources/noaa";
import { activityLevel, summarizeNight, type AuroraLevel } from "@/lib/aurora";
import { groupNights, TIME_ZONE } from "@/lib/weather";
import { locations, getLocation } from "@/lib/locations";
import { LocationPicker } from "@/components/location-picker";
import { WeatherIcon } from "@/components/weather-icon";

export function generateStaticParams() {
  return Object.keys(locations).map((location) => ({ location }));
}

const auroraStyles: Record<AuroraLevel, string> = {
  high: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  possible: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  low: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  none: "bg-slate-500/10 text-muted-foreground",
  daylight: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

const confidenceKeys = ["high", "medium", "low"] as const;

export default async function ForecastPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location } = await params;
  const place = getLocation(location);
  if (!place) notFound();

  const t = await getTranslations("Forecast");
  const tTonight = await getTranslations("Tonight");
  const locale = await getLocale();
  const intlLocale = locale === "no" ? "nb-NO" : "en-GB";

  const [metResult, kpResult] = await Promise.allSettled([
    fetchMetForecast(place.lat, place.lon),
    fetchKpForecast(),
  ]);

  const hours: MetHour[] =
    metResult.status === "fulfilled" ? metResult.value : [];
  const failed = metResult.status === "rejected";
  const kpPoints: KpPoint[] =
    kpResult.status === "fulfilled" ? kpResult.value : [];

  const nights = groupNights(hours, 3).map((n) => ({
    key: n.key,
    summary: summarizeNight(n.hours, kpPoints, place.lat, place.lon),
  }));

  const timeFmt = new Intl.DateTimeFormat(intlLocale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
  const dateFmt = new Intl.DateTimeFormat(intlLocale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE,
  });
  const weekdayFmt = new Intl.DateTimeFormat(intlLocale, {
    weekday: "long",
    timeZone: TIME_ZONE,
  });

  // "2026-10-21" → a Date at noon UTC on that day, safe for formatting
  const fromKey = (key: string) => new Date(`${key}T12:00:00Z`);

  const nightTitle = (index: number, key: string) => {
    if (index === 0) return t("tonight");
    if (index === 1) return t("tomorrow");
    const day = weekdayFmt.format(fromKey(key));
    return t("nightOf", { day: day.charAt(0).toUpperCase() + day.slice(1) });
  };

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("title", { place: place.name })}
        </h1>
        <p className="max-w-prose text-muted-foreground">{t("subtitle")}</p>
        <LocationPicker current={location} basePath="/forecast" />
      </div>

      {failed && (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">
          {tTonight("error")}
        </div>
      )}

      {!failed && nights.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("noData")}
        </div>
      )}

      {!failed && nights.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {nights.map(({ key, summary }, index) => (
            <article
              key={key}
              className="flex flex-col gap-4 rounded-lg border bg-card p-5"
            >
              <header className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    {nightTitle(index, key)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {dateFmt.format(fromKey(key))}
                  </p>
                </div>
                <span className="whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
                  {t(`confidence.${confidenceKeys[index] ?? "low"}`)}
                </span>
              </header>

              <div className="flex items-center gap-3">
                <Sparkles
                  className="h-8 w-8 shrink-0 text-emerald-500"
                  aria-hidden="true"
                />
                <div>
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${auroraStyles[summary.level]}`}
                  >
                    {summary.level === "none"
                      ? t("unlikely")
                      : tTonight(`aurora.${summary.level}`)}
                  </span>
                  {summary.bestTime && summary.level !== "none" && (
                    <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                      {tTonight("auroraBest", {
                        time: timeFmt.format(summary.bestTime),
                      })}
                    </p>
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t("activity")}</dt>
                  <dd className="font-medium">
                    {summary.maxKp === null ? (
                      "–"
                    ) : (
                      <>
                        {tTonight(`activity.${activityLevel(summary.maxKp)}`)}{" "}
                        <span className="text-xs text-muted-foreground tabular-nums">
                          (Kp {summary.maxKp.toFixed(1)})
                        </span>
                      </>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("clearest")}</dt>
                  <dd className="flex items-center gap-1.5 font-medium tabular-nums">
                    <WeatherIcon
                      symbol={summary.symbol}
                      className="h-5 w-5 shrink-0"
                    />
                    {summary.minCloud === null
                      ? "–"
                      : `${Math.round(summary.minCloud)}%`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("lowestTemp")}</dt>
                  <dd className="font-medium tabular-nums">
                    {summary.minTemp === null
                      ? "–"
                      : `${Math.round(summary.minTemp)}°`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("maxWind")}</dt>
                  <dd className="font-medium tabular-nums">
                    {summary.maxWind === null
                      ? "–"
                      : `${Math.round(summary.maxWind)} m/s`}
                    {summary.maxGust !== null && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (
                        {tTonight("gust", {
                          value: Math.round(summary.maxGust),
                        })}
                        )
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("precip")}</dt>
                  <dd className="font-medium tabular-nums">
                    {summary.precip === null
                      ? "–"
                      : `${summary.precip.toFixed(1)} mm`}
                  </dd>
                </div>
              </dl>

              {index === 0 && (
                <Link
                  href={`/tonight/${location}`}
                  className="mt-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  {t("hourByHour")}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="max-w-prose text-sm text-muted-foreground">{t("note")}</p>

      <p className="text-xs text-muted-foreground">
        <a
          href="https://www.met.no/en"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          {tTonight("credit")}
        </a>{" "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          {tTonight("licence")}
        </a>{" "}
        <a
          href="https://www.swpc.noaa.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          {tTonight("creditNoaa")}
        </a>
      </p>
    </section>
  );
}
