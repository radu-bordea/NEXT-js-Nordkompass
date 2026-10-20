import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Cloud, Droplets, Thermometer, Wind } from "lucide-react";
import { fetchMetForecast, type MetHour } from "@/lib/sources/met";
import {
  getTonightHours,
  skyLevel,
  TIME_ZONE,
  type SkyLevel,
} from "@/lib/weather";
import { locations, getLocation } from "@/lib/locations";
import { LocationPicker } from "@/components/location-picker";
import { WeatherIcon } from "@/components/weather-icon";

export function generateStaticParams() {
  return Object.keys(locations).map((location) => ({ location }));
}

const levelStyles: Record<SkyLevel, string> = {
  clear: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  partly: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  cloudy: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
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

  let hours: MetHour[] = [];
  let failed = false;
  try {
    hours = await fetchMetForecast(place.lat, place.lon);
  } catch {
    failed = true;
  }

  const tonight = getTonightHours(hours);
  const timeFmt = new Intl.DateTimeFormat(locale === "no" ? "nb-NO" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });

  const best = tonight
    .filter((h) => h.cloudTotal !== null)
    .reduce<MetHour | null>(
      (min, h) => (min === null || h.cloudTotal! < min.cloudTotal! ? h : min),
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
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("error")}
        </div>
      )}

      {!failed && best && (
        <div className="flex items-center gap-4 rounded-lg border bg-card p-5">
          <WeatherIcon symbol={best.symbol} className="h-10 w-10 shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">{t("bestLabel")}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {t("bestValue", {
                time: timeFmt.format(best.time),
                cloud: Math.round(best.cloudTotal!),
              })}
            </p>
          </div>
        </div>
      )}

      {!failed && tonight.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">
          {t("noHours")}
        </div>
      )}

      {!failed && tonight.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t("colTime")}</th>
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
              {tonight.map((h) => {
                const level = skyLevel(h.cloudTotal);
                const isBest = best !== null && h.time.getTime() === best.time.getTime();
                return (
                  <tr
                    key={h.time.toISOString()}
                    className={`border-b last:border-0 ${isBest ? "bg-primary/10" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {timeFmt.format(h.time)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <WeatherIcon symbol={h.symbol} className="h-6 w-6 shrink-0" />
                        <span
                          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${levelStyles[level]}`}
                        >
                          {t(`level.${level}`)}
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
        </a>
      </p>
    </section>
  );
}