import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Cloud, Droplets, Sparkles, Thermometer, Wind } from "lucide-react";
import { fetchMetForecast, type MetHour } from "@/lib/sources/met";
import { fetchKpForecast, type KpPoint } from "@/lib/sources/noaa";
import { activityLevel, auroraForHour, type AuroraLevel } from "@/lib/aurora";
import { getTonightHours, skyLevel, TIME_ZONE, type SkyLevel } from "@/lib/weather";
import { locations, getLocation } from "@/lib/locations";
import { LocationPicker } from "@/components/location-picker";
import { WeatherIcon } from "@/components/weather-icon";

export function generateStaticParams() {
  return Object.keys(locations).map((location) => ({ location }));
}

const skyStyles: Record<SkyLevel, string> = {
  clear: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  partly: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cloudy: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

const auroraStyles: Record<AuroraLevel, string> = {
  high: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  possible: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  low: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  none: "bg-slate-500/10 text-muted-foreground",
  daylight: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

export default async function TonightPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location } = await params;
  const place = getLocation(location);
  if (!place) notFound();

  const t = await getTranslations("Tonight");
  const locale = await getLocale();

  // Fetch weather and aurora data at the same time
  const [metResult, kpResult] = await Promise.allSettled([
    fetchMetForecast(place.lat, place.lon),
    fetchKpForecast(),
  ]);

  const hours: MetHour[] = metResult.status === "fulfilled" ? metResult.value : [];
  const failed = metResult.status === "rejected";
  const kpPoints: KpPoint[] = kpResult.status === "fulfilled" ? kpResult.value : [];
  const kpFailed = kpResult.status === "rejected";

  const rows = getTonightHours(hours).map((h) => ({
    h,
    aurora: auroraForHour(h, kpPoints, place.lat, place.lon),
  }));

  const timeFmt = new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });

  // Best aurora hour (highest score)
  const bestAurora = rows.reduce<(typeof rows)[number] | null>(
    (best, r) => (r.aurora.score > (best?.aurora.score ?? 0) ? r : best),
    null,
  );

  // Clearest hour (lowest cloud cover)
  const bestSky = rows
    .filter((r) => r.h.cloudTotal !== null)
    .reduce<MetHour | null>(
      (min, r) => (min === null || r.h.cloudTotal! < min.cloudTotal! ? r.h : min),
      null,
    );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("title", { place: place.name })}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
        <LocationPicker current={location} />
      </div>

      {failed && (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">{t("error")}</div>
      )}

      {!failed && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Aurora tonight */}
          <div className="flex items-center gap-4 rounded-lg border bg-card p-5">
            <Sparkles className="h-10 w-10 shrink-0 text-emerald-500" aria-hidden="true" />
            <div>
              <p className="text-sm text-muted-foreground">{t("auroraLabel")}</p>
              {bestAurora && bestAurora.aurora.level !== "none" ? (
                <>
                  <p className="mt-1 text-2xl font-semibold">
                    {t(`aurora.${bestAurora.aurora.level}`)}
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {t("auroraBest", { time: timeFmt.format(bestAurora.h.time) })}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-2xl font-semibold">{t("auroraNone")}</p>
              )}
            </div>
          </div>

          {/* Clearest sky */}
          {bestSky && (
            <div className="flex items-center gap-4 rounded-lg border bg-card p-5">
              <WeatherIcon symbol={bestSky.symbol} className="h-10 w-10 shrink-0" />
              <div>
                <p className="text-sm text-muted-foreground">{t("bestLabel")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {t("bestValue", {
                    time: timeFmt.format(bestSky.time),
                    cloud: Math.round(bestSky.cloudTotal!),
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {!failed && kpFailed && (
        <p className="text-sm text-muted-foreground">{t("kpMissing")}</p>
      )}

      {!failed && rows.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">{t("noHours")}</div>
      )}

      {!failed && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="sticky left-0 z-10 border-r bg-card px-4 py-3 font-medium">
                  {t("colTime")}
                </th>
                <th className="px-4 py-3 font-medium">{t("colAurora")}</th>
                <th className="px-4 py-3 font-medium">{t("colActivity")}</th>
                <th className="px-4 py-3 font-medium">{t("colSky")}</th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Cloud className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("colCloud")}
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("colPrecip")}
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("colTemp")}
                  </span>
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Wind className="h-3.5 w-3.5" aria-hidden="true" />
                    {t("colWind")}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ h, aurora }) => {
                const sky = skyLevel(h.cloudTotal);
                const isBest =
                  bestAurora !== null &&
                  bestAurora.aurora.level !== "none" &&
                  h.time.getTime() === bestAurora.h.time.getTime();
                return (
                  <tr
                    key={h.time.toISOString()}
                    className={`border-b last:border-0 ${isBest ? "bg-primary/10" : ""}`}
                  >
                    <td
                      className={`sticky left-0 z-10 border-r bg-card px-4 py-3 font-medium tabular-nums ${
                        isBest ? "shadow-[inset_0_0_0_100vmax] shadow-primary/10" : ""
                      }`}
                    >
                      {timeFmt.format(h.time)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${auroraStyles[aurora.level]}`}
                      >
                        {t(`aurora.${aurora.level}`)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {aurora.kp === null ? (
                        "–"
                      ) : (
                        <>
                          {t(`activity.${activityLevel(aurora.kp)}`)}{" "}
                          <span className="text-xs text-muted-foreground tabular-nums">
                            (Kp {aurora.kp.toFixed(1)})
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <WeatherIcon symbol={h.symbol} className="h-6 w-6 shrink-0" />
                        <span
                          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${skyStyles[sky]}`}
                        >
                          {t(`level.${sky}`)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {h.cloudTotal === null ? "–" : `${Math.round(h.cloudTotal)}%`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {h.precipitation === null ? "–" : `${h.precipitation.toFixed(1)} mm`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {h.temperature === null ? "–" : `${Math.round(h.temperature)}°`}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {h.windSpeed === null ? "–" : `${Math.round(h.windSpeed)} m/s`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!failed && rows.length > 0 && (
        <p className="max-w-prose text-sm text-muted-foreground">{t("kpExplain")}</p>
      )}

      <p className="text-xs text-muted-foreground">
        <a
          href="https://www.met.no/en"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          {t("credit")}
        </a>{" "}
        <a
          href="https://creativecommons.org/licenses/by/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          {t("licence")}
        </a>{" "}
        <a
          href="https://www.swpc.noaa.gov/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          {t("creditNoaa")}
        </a>
      </p>
    </section>
  );
}