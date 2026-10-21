import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Cloud, Droplets, Sparkles, Thermometer, Wind } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { fetchMetForecast, type MetHour } from "@/lib/sources/met";
import { fetchKpForecast, type KpPoint } from "@/lib/sources/noaa";
import {
  activityLevel,
  auroraForHour,
  levelFromScore,
  pickBest,
  spotTonight,
  type AuroraLevel,
} from "@/lib/aurora";
import { getTonightHours, skyLevel, TIME_ZONE, type SkyLevel } from "@/lib/weather";
import { locations, getLocation } from "@/lib/locations";
import { LocationPicker } from "@/components/location-picker";
import { WeatherIcon } from "@/components/weather-icon";
import { SpotsMap, type MapSpot } from "@/components/spots-map";

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

  // Hour by hour for the area's own point (e.g. Bodø centre)
  const rows = getTonightHours(hours).map((h) => ({
    h,
    aurora: auroraForHour(h, kpPoints, place.lat, place.lon),
  }));

  const timeFmt = new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });

  // Earliest hour that's nearly as good as the best, plus the good window (area point)
  const auroraPick = pickBest(rows, (r) => r.aurora.score);
  const bestAurora = auroraPick.best;
  const goodUntil = auroraPick.last;
  const tonightLevel: AuroraLevel = bestAurora ? levelFromScore(auroraPick.max) : "none";

  // Clearest hour (lowest cloud cover)
  const bestSky = rows
    .filter((r) => r.h.cloudTotal !== null)
    .reduce<MetHour | null>(
      (min, r) => (min === null || r.h.cloudTotal! < min.cloudTotal! ? r.h : min),
      null,
    );

  // Weather for each spot in this area, then rank by tonight's best chance
  const spotWeather = await Promise.allSettled(
    place.spots.map((s) => fetchMetForecast(s.lat, s.lon)),
  );

  const rankedSpots = place.spots
    .map((spot, i) => {
      const result = spotWeather[i];
      const spotHours = result.status === "fulfilled" ? getTonightHours(result.value) : [];
      return { spot, tonight: spotTonight(spotHours, kpPoints, spot) };
    })
    .sort((a, b) => b.tonight.score - a.tonight.score);

  // The card summarises the best spot when the area has spots, otherwise the area itself
  const topSpot = rankedSpots[0];
  const card =
    topSpot && topSpot.tonight.level !== "none"
      ? {
          level: topSpot.tonight.level,
          best: topSpot.tonight.bestTime,
          until: topSpot.tonight.goodUntil,
          spotName: topSpot.spot.name as string | null,
        }
      : {
          level: tonightLevel,
          best: bestAurora?.h.time ?? null,
          until: goodUntil?.h.time ?? null,
          spotName: null as string | null,
        };

  const noteLang = locale === "no" ? "no" : "en";

  const spotDetail = (s: (typeof rankedSpots)[number]) =>
    [
      s.tonight.bestTime && s.tonight.level !== "none"
        ? t("spotBest", { time: timeFmt.format(s.tonight.bestTime) })
        : null,
      s.tonight.cloud !== null ? t("spotCloud", { cloud: Math.round(s.tonight.cloud) }) : null,
      t("spotDarkness", { value: s.spot.darkness }),
    ]
      .filter(Boolean)
      .join(" · ");

  const mapSpots: MapSpot[] = rankedSpots.map((s) => ({
    slug: s.spot.slug,
    name: s.spot.name,
    lat: s.spot.lat,
    lon: s.spot.lon,
    level: s.tonight.level,
    levelLabel: t(`aurora.${s.tonight.level}`),
    detail: spotDetail(s),
    note: s.spot.note[noteLang],
    pulse: s.tonight.nowLevel === "high",
  }));

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
          {/* Aurora tonight (best spot, or the area itself) */}
          <div
            className={`flex items-center gap-4 rounded-lg border bg-card p-5 ${
              card.level === "high" ? "aurora-glow" : ""
            }`}
          >
            <Sparkles className="relative h-10 w-10 shrink-0 text-emerald-500" aria-hidden="true" />
            <div className="relative">
              <p className="text-sm text-muted-foreground">{t("auroraLabel")}</p>
              {card.best && card.level !== "none" ? (
                <>
                  <p className="mt-1 text-2xl font-semibold">{t(`aurora.${card.level}`)}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {card.spotName
                      ? t("auroraBestAt", { time: timeFmt.format(card.best), spot: card.spotName })
                      : t("auroraBest", { time: timeFmt.format(card.best) })}
                    {card.until && card.until.getTime() !== card.best.getTime() && (
                      <>
                        {" · "}
                        {t("auroraWindow", {
                          from: timeFmt.format(card.best),
                          to: timeFmt.format(card.until),
                        })}
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-2xl font-semibold">{t("auroraNone")}</p>
              )}
            </div>
          </div>

          {/* Clearest sky (area point) */}
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

      {/* Best spots tonight */}
      {!failed && rankedSpots.length > 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold">{t("spotsTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("spotsSubtitle")}</p>
          </div>

          <SpotsMap spots={mapSpots} />

          <div className="flex flex-wrap gap-2">
            {(["high", "possible", "low", "none"] as const).map((level) => (
              <span
                key={level}
                className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${auroraStyles[level]}`}
              >
                {t(`aurora.${level}`)}
              </span>
            ))}
          </div>

          <ol className="flex flex-col gap-2">
            {rankedSpots.map((s, i) => (
              <li key={s.spot.slug} className="flex items-start gap-3 rounded-lg border bg-card p-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.spot.name}</span>
                    <span
                      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${auroraStyles[s.tonight.level]}`}
                    >
                      {t(`aurora.${s.tonight.level}`)}
                    </span>
                    {s.tonight.nowLevel === "high" && (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                        {t("spotNow")}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground tabular-nums">{spotDetail(s)}</p>
                  <p className="text-sm text-muted-foreground">{s.spot.note[noteLang]}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!failed && kpFailed && <p className="text-sm text-muted-foreground">{t("kpMissing")}</p>}

      {!failed && rows.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">{t("noHours")}</div>
      )}

      {/* Hour by hour (area point) */}
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
                  tonightLevel !== "none" &&
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
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      {h.windSpeed === null ? "–" : `${Math.round(h.windSpeed)} m/s`}
                      {h.windGust !== null && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({t("gust", { value: Math.round(h.windGust) })})
                        </span>
                      )}
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

      <Link
        href={`/forecast/${location}`}
        className="w-fit text-sm font-medium text-primary hover:underline"
      >
        {t("nextNights")} →
      </Link>

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