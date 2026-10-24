/**
 * Tonight page: /tonight/[location]  (e.g. /tonight/bodo, /no/tonight/bodo)
 *
 * The page answers two different questions:
 *
 *  1. "RIGHT NOW"  (step 2, live)
 *     - NOAA OVATION: live aurora chance per map square (updates ~5 min)
 *     - NOAA solar wind: Bz (negative = aurora can get stronger soon)
 *     - MET: cloud cover this hour at each spot
 *     - Sun position: is it dark enough?
 *     → "Strong aurora" / "Go out now" / "Maybe" / "Not now" / "Too cloudy" / "Too bright"
 *     → drives the "Right now" card, the pulsing dots and the "now" badge
 *     → pulse: maybe = 1 slow blue ring, go = 3 green waves, storm = 3 fast pink waves
 *     → "Check my location" does the same calculation for the visitor's own position
 *       (components/my-location.tsx → app/api/now/route.ts)
 *
 *  2. "TONIGHT'S FORECAST"  (step 1, plan)
 *     - NOAA Kp forecast (3-hour blocks, same for the whole planet)
 *     - MET hourly clouds + darkness
 *     → "Possible, best around 23:00", ranked spots, hour-by-hour table
 *
 *  3. MOON (lib/moon.ts): phase, % lit, when it's up → moon card.
 *     Also a small factor (max −15%, only for weak/medium aurora) in both scores.
 *
 * Rule to avoid confusion: for THIS MOMENT the live data always wins.
 * The forecast is only used to describe LATER tonight.
 * If live NOAA data fails, we fall back to step 1 for everything.
 *
 * TESTING (development only, ignored in production):
 *   ?glowTest=quiet|normal|good|strong|storm|narrow|faint  → fake aurora glow (lib/glow-test.ts)
 *   ?pulseTest=maybe|go|storm                               → every spot pulses at that level
 *   e.g. http://localhost:3000/tonight/bodo?pulseTest=storm&glowTest=storm
 */

import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Cloud,
  Droplets,
  Navigation,
  Sparkles,
  Thermometer,
  Wind,
} from "lucide-react";
import { Link } from "@/i18n/navigation";

// Data sources
import { fetchMetForecast, type MetHour } from "@/lib/sources/met"; // weather (MET Norway)
import { fetchKpForecast, type KpPoint } from "@/lib/sources/noaa"; // Kp forecast (step 1)
import { fetchOvation } from "@/lib/sources/ovation"; // live aurora map (step 2)
import { fetchSolarWind } from "@/lib/sources/solar-wind"; // live solar wind (step 2)

// Calculations
import {
  activityLevel,
  auroraForHour,
  levelFromScore,
  pickBest,
  spotTonight,
  type AuroraLevel,
} from "@/lib/aurora"; // step 1 scoring
import {
  pulseFor,
  spotNow,
  type LiveStatus,
  type PulseLevel,
} from "@/lib/aurora-live"; // step 2 scoring
import {
  getTonightHours,
  skyLevel,
  TIME_ZONE,
  type SkyLevel,
} from "@/lib/weather";
import type { Spot } from "@/lib/locations"; // shared type only
import { getArea, listAreas } from "@/lib/areas"; // areas + spots from the database
import { glowTest } from "@/lib/glow-test"; // dev-only fake aurora bands
import { moonTonight } from "@/lib/moon"; // moon phase + when it's up
import { GLOW_BOX } from "@/lib/glow"; // area of the map glow
import { directionsUrl } from "@/lib/directions"; // Google Maps navigation link

// UI
import { LocationPicker } from "@/components/location-picker";
import { WeatherIcon } from "@/components/weather-icon";
import { SpotsMap, type MapSpot } from "@/components/spots-map";
import { RightNow } from "@/components/right-now";
import { AutoRefresh } from "@/components/auto-refresh";
import { MoonCard } from "@/components/moon-card";
import { MyLocation } from "@/components/my-location";

// "Right now" must be computed on every request.
// MET and Kp fetches still use their own cache (revalidate), so MET isn't spammed.
export const dynamic = "force-dynamic";

// One page per area (bodo, kjerringoy, saltstraumen, ...), from the database
export async function generateStaticParams() {
  const areas = await listAreas();
  return areas.map((area) => ({ location: area.slug }));
}

// Badge colors for the sky column
const skyStyles: Record<SkyLevel, string> = {
  clear: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  partly: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cloudy: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
};

// Badge colors for aurora levels (forecast)
const auroraStyles: Record<AuroraLevel, string> = {
  high: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  possible: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  low: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  none: "bg-slate-500/10 text-muted-foreground",
  daylight: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
};

// "Visible now" badge (live) – same green as the pulsing map dot
const nowBadgeClass =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300";

// "Storm now" badge (live) – same pink as the storm pulse and glow
const stormBadgeClass =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-fuchsia-500/15 px-2.5 py-0.5 text-xs font-medium text-fuchsia-700 dark:text-fuchsia-300";

/**
 * Fallback: turn a step 1 level into a "right now" status.
 * Only used when OVATION (live) could not be fetched.
 */
function fallbackStatus(level: AuroraLevel | null | undefined): LiveStatus {
  if (level === "high") return "go";
  if (level === "possible") return "maybe";
  if (level === "daylight") return "daylight";
  return "wait";
}

export default async function TonightPage({
  params,
  searchParams,
}: {
  params: Promise<{ location: string }>;
  searchParams: Promise<{ glowTest?: string; pulseTest?: string }>;
}) {
  const { location } = await params;
  const { glowTest: glowTestName, pulseTest } = await searchParams;
  const place = await getArea(location); // from the database
  if (!place) notFound();

  const t = await getTranslations("Tonight");
  const tMap = await getTranslations("Map");
  const locale = await getLocale();

  // ======================================================================
  // 1. FETCH DATA (all at once; allSettled = one failure doesn't break the page)
  // ======================================================================
  const [metResult, kpResult, ovationResult, windResult] =
    await Promise.allSettled([
      fetchMetForecast(place.lat, place.lon), // weather at the area centre
      fetchKpForecast(), // step 1: Kp forecast
      fetchOvation(), // step 2: live aurora chance grid
      fetchSolarWind(), // step 2: live Bz / speed
    ]);

  const hours: MetHour[] =
    metResult.status === "fulfilled" ? metResult.value : [];
  const failed = metResult.status === "rejected"; // no weather → show error box
  const kpPoints: KpPoint[] =
    kpResult.status === "fulfilled" ? kpResult.value : [];
  const kpFailed = kpResult.status === "rejected";
  const ovation =
    ovationResult.status === "fulfilled" ? ovationResult.value : null; // null → fallback to step 1
  const wind = windResult.status === "fulfilled" ? windResult.value : null; // null → no Bz boost
  const now = new Date();

  // Time format in Norwegian time (e.g. "23:00")
  const timeFmt = new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });

  // ======================================================================
  // 2. STEP 1 FOR THE AREA POINT (hour-by-hour table)
  // ======================================================================
  // Tonight's hours (18:00–06:00) with an aurora score for each hour
  const rows = getTonightHours(hours).map((h) => ({
    h,
    aurora: auroraForHour(h, kpPoints, place.lat, place.lon),
  }));

  // Earliest hour that's nearly as good as the best (90%), and until when it stays good
  const auroraPick = pickBest(rows, (r) => r.aurora.score);
  const bestAurora = auroraPick.best;
  const goodUntil = auroraPick.last;
  const tonightLevel: AuroraLevel = bestAurora
    ? levelFromScore(auroraPick.max)
    : "none";

  // Clearest hour tonight (lowest cloud cover)
  const bestSky = rows
    .filter((r) => r.h.cloudTotal !== null)
    .reduce<MetHour | null>(
      (min, r) =>
        min === null || r.h.cloudTotal! < min.cloudTotal! ? r.h : min,
      null,
    );

  // Moon during tonight's hours (first hour → end of last hour),
  // or the next 12 hours if no night hours are left
  const nightStart = rows[0]?.h.time ?? now;
  const nightEnd = rows.length
    ? new Date(rows[rows.length - 1].h.time.getTime() + 60 * 60 * 1000)
    : new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const moon = moonTonight(nightStart, nightEnd, place.lat, place.lon);

  // ======================================================================
  // 3. SPOTS: step 1 (tonight) + step 2 (live) for each spot
  // ======================================================================
  // Each spot has its own MET weather (clouds can differ a lot within 20 km)
  const spotWeather = await Promise.allSettled(
    place.spots.map((s) => fetchMetForecast(s.lat, s.lon)),
  );

  const rankedSpots = place.spots
    .map((spot, i) => {
      const result = spotWeather[i];
      const allHours = result.status === "fulfilled" ? result.value : [];
      return {
        spot,
        // Step 1: best time tonight, level, cloud (uses tonight's hours only)
        tonight: spotTonight(getTonightHours(allHours), kpPoints, spot),
        // Step 2: status right now (needs all hours so the current hour is always found)
        live: ovation ? spotNow(spot, allHours, ovation, wind, now) : null,
      };
    })
    // The list and map numbers are ranked by tonight's plan (stable all evening)
    .sort((a, b) => b.tonight.score - a.tonight.score);

  // ======================================================================
  // 4. RIGHT NOW (step 2)
  // ======================================================================
  // Spot with the best live score right now
  const liveBest = rankedSpots
    .filter((s) => s.live !== null)
    .sort((a, b) => b.live!.score - a.live!.score)[0];

  // Areas without spots (e.g. Svolvær): treat the area centre as a "spot"
  const areaAsSpot = {
    slug: location,
    name: place.name,
    lat: place.lat,
    lon: place.lon,
    darkness: 2, // town centre → some light pollution
    viewNorth: true,
    note: { en: "", no: "" },
    verified: false,
  } as Spot;

  const areaLive =
    !liveBest && ovation
      ? spotNow(areaAsSpot, hours, ovation, wind, now)
      : null;

  // Live result used by the "Right now" card (best spot, or the area centre)
  const nowLive = liveBest?.live ?? areaLive;

  // Final status: live when available, otherwise step 1 fallback
  const nowStatus: LiveStatus = nowLive
    ? nowLive.status
    : fallbackStatus(rankedSpots[0]?.tonight.nowLevel);

  // True when aurora is visible somewhere right now → overrides the forecast card
  const liveGo = nowStatus === "go" || nowStatus === "storm";

  // Per spot: how should it pulse? (maybe / go / storm / none)
  // Live data when available, otherwise step 1's current-hour level.
  const pulseOf = (s: (typeof rankedSpots)[number]): PulseLevel => {
    if (s.live) return pulseFor(s.live.status);
    if (s.tonight.nowLevel === "high") return "go";
    if (s.tonight.nowLevel === "possible") return "maybe";
    return null;
  };

  // "Go" or "Storm" = aurora visible now → the spot shows the "now" badge
  const isNow = (s: (typeof rankedSpots)[number]) => {
    const p = pulseOf(s);
    return p === "go" || p === "storm";
  };

  // ======================================================================
  // 5. TONIGHT'S FORECAST CARD (step 1)
  // ======================================================================
  // Summarises the best spot when the area has spots, otherwise the area itself
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

  // ======================================================================
  // 6. MAP + LIST DATA
  // ======================================================================
  const noteLang = locale === "no" ? "no" : "en";

  // Small detail line under each spot: "Best 23:00 · Cloud 20% · Darkness 4/5"
  const spotDetail = (s: (typeof rankedSpots)[number]) =>
    [
      s.tonight.bestTime && s.tonight.level !== "none"
        ? t("spotBest", { time: timeFmt.format(s.tonight.bestTime) })
        : null,
      s.tonight.cloud !== null
        ? t("spotCloud", { cloud: Math.round(s.tonight.cloud) })
        : null,
      t("spotDarkness", { value: s.spot.darkness }),
    ]
      .filter(Boolean)
      .join(" · ");

  // Map dots: when a spot is "Go"/"Storm" right now, it's shown as High + "Visible now".
  // Otherwise it shows tonight's forecast level. The pulse shows the live level
  // (a "Maybe" spot keeps its forecast color but gets one slow blue ring).
  // DEV ONLY: ?pulseTest=maybe|go|storm makes every spot pulse at that level
  const testPulse: PulseLevel =
    process.env.NODE_ENV !== "production" &&
    (pulseTest === "maybe" || pulseTest === "go" || pulseTest === "storm")
      ? pulseTest
      : null;

  const mapSpots: MapSpot[] = rankedSpots.map((s) => {
    const pulse = testPulse ?? pulseOf(s);
    return {
      slug: s.spot.slug,
      name: s.spot.name,
      lat: s.spot.lat,
      lon: s.spot.lon,
      level: isNow(s) ? "high" : s.tonight.level,
      levelLabel:
        pulse === "storm"
          ? t("spotStorm")
          : pulse === "go"
            ? t("spotNow")
            : t(`aurora.${s.tonight.level}`),
      detail: spotDetail(s),
      note: s.spot.note[noteLang],
      pulse,
    };
  });

  // Aurora glow for the map.
  // Normal: real OVATION values (under 3 are skipped, so daytime gives few or no points).
  // Dev test: ?glowTest=storm etc. replaces them with a fake band (null in production).
  const testGlow = glowTest(glowTestName, GLOW_BOX);
  // min 1 (instead of 3) so the glow fades out softly instead of stopping at a hard edge
  const glow = testGlow ?? (ovation ? ovation.points(GLOW_BOX, 1) : []);

  // Glow on by default at night (or always while testing), off in daylight
  const glowOn = testGlow !== null || nowStatus !== "daylight";

  // Legend text: real update time, or which test is running
  const glowUpdated = testGlow
    ? `TEST ${glowTestName}`
    : ovation
      ? timeFmt.format(ovation.observed)
      : null;

  // ======================================================================
  // 7. RENDER
  // ======================================================================
  return (
    <section className="flex flex-col gap-6">
      {/* Re-fetches the page every 5 min while the tab is open (lobby screens, phones) */}
      <AutoRefresh seconds={300} />

      {/* Title + area picker */}
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("title", { place: place.name })}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
        <LocationPicker current={location} />
      </div>

      {/* RIGHT NOW (step 2): live OVATION + solar wind + MET cloud, falls back to step 1 */}
      <RightNow
        status={nowStatus}
        live={nowLive !== null}
        spotName={liveBest ? liveBest.spot.name : undefined}
        chance={nowLive?.chance}
        cloud={nowLive?.cloud}
        strengthening={nowLive?.strengthening}
        wind={wind}
        updated={ovation?.observed ?? null}
      />

      {/* CHECK MY LOCATION for areas WITHOUT a map (e.g. Svolvær).
          With a map, the card sits right under the map instead (see below). */}
      {(failed || rankedSpots.length === 0) && <MyLocation />}

      {/* MET failed → no weather at all */}
      {failed && (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("error")}
        </div>
      )}

      {!failed && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* TONIGHT'S FORECAST card (step 1) – but if aurora is visible now, say so */}
          <div
            className={`flex items-center gap-4 rounded-lg border bg-card p-5 ${
              card.level === "high" || liveGo ? "aurora-glow" : ""
            }`}
          >
            <Sparkles
              className="relative h-10 w-10 shrink-0 text-emerald-500"
              aria-hidden="true"
            />
            <div className="relative">
              <p className="text-sm text-muted-foreground">
                {t("auroraLabel")}
              </p>

              {liveGo ? (
                // A) Live says "Go" → card agrees: High, happening now
                <>
                  <p className="mt-1 text-2xl font-semibold">
                    {t("aurora.high")}
                  </p>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    {t("happeningNow")}
                    {liveBest ? ` · ${liveBest.spot.name}` : ""}
                  </p>
                </>
              ) : card.best && card.level !== "none" ? (
                // B) Normal forecast: level + best time + good window
                <>
                  <p className="mt-1 text-2xl font-semibold">
                    {t(`aurora.${card.level}`)}
                  </p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {card.spotName
                      ? t("auroraBestAt", {
                          time: timeFmt.format(card.best),
                          spot: card.spotName,
                        })
                      : t("auroraBest", { time: timeFmt.format(card.best) })}
                    {card.until &&
                      card.until.getTime() !== card.best.getTime() && (
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
                // C) Nothing expected tonight
                <p className="mt-1 text-2xl font-semibold">{t("auroraNone")}</p>
              )}
            </div>
          </div>

          {/* Clearest sky tonight (area point) */}
          {bestSky && (
            <div className="flex items-center gap-4 rounded-lg border bg-card p-5">
              <WeatherIcon
                symbol={bestSky.symbol}
                className="h-10 w-10 shrink-0"
              />
              <div>
                <p className="text-sm text-muted-foreground">
                  {t("bestLabel")}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {t("bestValue", {
                    time: timeFmt.format(bestSky.time),
                    cloud: Math.round(bestSky.cloudTotal!),
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Moon tonight: phase, when it's up, effect on weak aurora */}
          <MoonCard moon={moon} timeFmt={timeFmt} />
        </div>
      )}

      {/* BEST SPOTS: map + ranked list */}
      {!failed && rankedSpots.length > 0 && (
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold">{t("spotsTitle")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("spotsSubtitle")}
            </p>
          </div>

          {/* Map: glow layer + numbered spots (pulse when "Go") */}
          <SpotsMap
            spots={mapSpots}
            glow={glow}
            glowOn={glowOn}
            glowUpdated={glowUpdated}
          />

          {/* CHECK MY LOCATION: right under the map, so the blue "You are here"
              dot and the answer are seen together. The map's "My location"
              button starts the same check. */}
          <MyLocation />

          {/* Legend for the dot colors */}
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

          {/* Legend for the pulse rings (live) */}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-sky-500" />
              {tMap("pulseMaybe")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-emerald-500 ring-2 ring-emerald-500/40 ring-offset-1 ring-offset-background" />
              {tMap("pulseGo")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-fuchsia-500 ring-2 ring-fuchsia-500/40 ring-offset-1 ring-offset-background" />
              {tMap("pulseStorm")}
            </span>
          </p>

          {/* Ranked list – numbers match the map dots */}
          <ol className="flex flex-col gap-2">
            {rankedSpots.map((s, i) => (
              <li
                key={s.spot.slug}
                className="flex items-start gap-3 rounded-lg border bg-card p-4"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold tabular-nums">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{s.spot.name}</span>

                    {/* ONE badge per spot: live "Storm now"/"Visible now" wins, otherwise tonight's level */}
                    {pulseOf(s) === "storm" ? (
                      <span className={stormBadgeClass}>
                        <span className="h-2 w-2 animate-pulse rounded-full bg-fuchsia-500" />
                        {t("spotStorm")}
                      </span>
                    ) : isNow(s) ? (
                      <span className={nowBadgeClass}>
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                        {t("spotNow")}
                      </span>
                    ) : (
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${auroraStyles[s.tonight.level]}`}
                      >
                        {t(`aurora.${s.tonight.level}`)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {spotDetail(s)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {s.spot.note[noteLang]}
                  </p>

                  {/* Opens Google Maps on the phone, ready to navigate */}
                  <a
                    href={directionsUrl(s.spot.lat, s.spot.lon)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                    {tMap("directions")}
                  </a>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Kp forecast failed → table still shows weather, aurora is less precise */}
      {!failed && kpFailed && (
        <p className="text-sm text-muted-foreground">{t("kpMissing")}</p>
      )}

      {/* No hours left tonight (e.g. very late morning) */}
      {!failed && rows.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("noHours")}
        </div>
      )}

      {/* HOUR BY HOUR (step 1, area point). Time column is sticky on mobile scroll. */}
      {!failed && rows.length > 0 && (
        <div className="flex flex-col gap-1">
          {/* Which place the table is for: the AREA point (e.g. Bodø centre),
              not the spots. Each spot on the map has its own weather. */}
          <h2 className="text-xl font-semibold">
            {t("tableTitle", { place: place.name })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("tableNote", { place: place.name })}
          </p>
        </div>
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
                // Highlight the best hour of tonight's forecast
                const isBest =
                  bestAurora !== null &&
                  tonightLevel !== "none" &&
                  h.time.getTime() === bestAurora.h.time.getTime();
                return (
                  <tr
                    key={h.time.toISOString()}
                    className={`border-b last:border-0 ${isBest ? "bg-primary/10" : ""}`}
                  >
                    {/* Sticky time cell (shadow trick keeps the highlight on the sticky cell) */}
                    <td
                      className={`sticky left-0 z-10 border-r bg-card px-4 py-3 font-medium tabular-nums ${
                        isBest
                          ? "shadow-[inset_0_0_0_100vmax] shadow-primary/10"
                          : ""
                      }`}
                    >
                      {timeFmt.format(h.time)}
                    </td>

                    {/* Aurora level for this hour */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${auroraStyles[aurora.level]}`}
                      >
                        {t(`aurora.${aurora.level}`)}
                      </span>
                    </td>

                    {/* Activity in words + Kp number */}
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

                    {/* Weather icon + clear/partly/cloudy */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <WeatherIcon
                          symbol={h.symbol}
                          className="h-6 w-6 shrink-0"
                        />
                        <span
                          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${skyStyles[sky]}`}
                        >
                          {t(`level.${sky}`)}
                        </span>
                      </div>
                    </td>

                    {/* Cloud % */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {h.cloudTotal === null
                        ? "–"
                        : `${Math.round(h.cloudTotal)}%`}
                    </td>

                    {/* Rain/snow mm */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {h.precipitation === null
                        ? "–"
                        : `${h.precipitation.toFixed(1)} mm`}
                    </td>

                    {/* Temperature */}
                    <td className="px-4 py-3 text-right tabular-nums">
                      {h.temperature === null
                        ? "–"
                        : `${Math.round(h.temperature)}°`}
                    </td>

                    {/* Wind + gusts */}
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      {h.windSpeed === null
                        ? "–"
                        : `${Math.round(h.windSpeed)} m/s`}
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

      {/* What Kp means, in plain words */}
      {!failed && rows.length > 0 && (
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("kpExplain")}
        </p>
      )}

      {/* Link to the 3-night forecast */}
      <Link
        href={`/forecast/${location}`}
        className="w-fit text-sm font-medium text-primary hover:underline"
      >
        {t("nextNights")} →
      </Link>

      {/* Data credits (required by MET's CC BY 4.0 licence) */}
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