import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { fetchMetForecast, type MetHour } from "@/lib/sources/met";
import { getTonightHours, skyLevel, TIME_ZONE, type SkyLevel } from "@/lib/weather";

const places: Record<string, { name: string; lat: number; lon: number }> = {
  bodo: { name: "Bodø", lat: 67.2804, lon: 14.4049 },
  saltstraumen: { name: "Saltstraumen", lat: 67.2333, lon: 14.6167 },
  kjerringoy: { name: "Kjerringøy", lat: 67.5194, lon: 14.7617 },
  svolvaer: { name: "Svolvær", lat: 68.2342, lon: 14.5683 },
};

export function generateStaticParams() {
  return Object.keys(places).map((location) => ({ location }));
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
  const place = places[location];
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
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("title", { place: place.name })}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      {failed && (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">{t("error")}</div>
      )}

      {!failed && best && (
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm text-muted-foreground">{t("bestLabel")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {t("bestValue", {
              time: timeFmt.format(best.time),
              cloud: Math.round(best.cloudTotal!),
            })}
          </p>
        </div>
      )}

      {!failed && tonight.length === 0 && (
        <div className="rounded-lg border bg-card p-6 text-muted-foreground">{t("noHours")}</div>
      )}

      {!failed && tonight.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t("colTime")}</th>
                <th className="px-4 py-3 font-medium">{t("colSky")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("colCloud")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("colTemp")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("colWind")}</th>
              </tr>
            </thead>
            <tbody>
              {tonight.map((h) => {
                const level = skyLevel(h.cloudTotal);
                const isBest = best && h.time.getTime() === best.time.getTime();
                return (
                  <tr
                    key={h.time.toISOString()}
                    className={`border-b last:border-0 ${isBest ? "bg-primary/10" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {timeFmt.format(h.time)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${levelStyles[level]}`}
                      >
                        {t(`level.${level}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {h.cloudTotal === null ? "–" : `${Math.round(h.cloudTotal)}%`}
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

      <p className="text-xs text-muted-foreground">{t("credit")}</p>
    </section>
  );
}