/**
 * "Right now" card at the top of the Tonight page (step 2, live).
 * Shows the status of the best spot right now:
 *   storm (pink) · go (green) · maybe (blue) · wait · cloudy · daylight
 * plus aurora chance, cloud, best spot, solar wind and update time.
 * Falls back to step 1 (forecast) when live NOAA data is missing.
 */

import { useTranslations } from "next-intl";
import type { LiveStatus } from "@/lib/aurora-live";
import type { SolarWind } from "@/lib/sources/solar-wind";

// Card border/background per status
const STYLES: Record<LiveStatus, string> = {
  storm: "border-fuchsia-500/60 bg-fuchsia-500/10",
  go: "border-emerald-500/60 bg-emerald-500/10",
  maybe: "border-sky-500/60 bg-sky-500/10",
  wait: "border-border bg-card",
  cloudy: "border-border bg-card",
  daylight: "border-border bg-card",
};

// Status dot color
const DOT: Record<LiveStatus, string> = {
  storm: "bg-fuchsia-500",
  go: "bg-emerald-500",
  maybe: "bg-sky-500",
  wait: "bg-muted-foreground",
  cloudy: "bg-muted-foreground",
  daylight: "bg-amber-400",
};

const timeFmt = new Intl.DateTimeFormat("nb-NO", {
  timeZone: "Europe/Oslo",
  hour: "2-digit",
  minute: "2-digit",
});

type Props = {
  status: LiveStatus;
  live: boolean; // false = OVATION failed, showing step 1 forecast
  spotName?: string;
  chance?: number;
  cloud?: number | null;
  strengthening?: boolean;
  wind?: SolarWind | null;
  updated?: Date | null;
};

export function RightNow({
  status, live, spotName, chance, cloud, strengthening, wind, updated,
}: Props) {
  const t = useTranslations("Now");
  const night = status !== "daylight";
  const animated = status === "go" || status === "storm";

  return (
    <section className={`rounded-xl border p-5 ${STYLES[status]}`}>
      <p className="text-sm font-medium text-muted-foreground">{t("title")}</p>

      <div className="mt-1 flex items-center gap-3">
        <span className="relative flex size-3">
          {animated && (
            <span
              className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 motion-reduce:animate-none ${DOT[status]}`}
            />
          )}
          <span className={`relative inline-flex size-3 rounded-full ${DOT[status]}`} />
        </span>
        <h2 className="text-2xl font-bold">{t(status)}</h2>
      </div>

      {live && night && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {chance !== undefined && <span>{t("chance", { chance })}</span>}
          {cloud !== null && cloud !== undefined && (
            <span>{t("cloud", { cloud: Math.round(cloud) })}</span>
          )}
          {spotName && <span>{t("bestSpot", { spot: spotName })}</span>}
        </div>
      )}

      {live && night && strengthening && (
        <p className="mt-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          {t("strengthening")}
        </p>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        {live && updated
          ? t("updated", { time: timeFmt.format(updated) })
          : t("forecastOnly")}
        {live && wind?.bzAvg30 != null && (
          <>
            {" · "}
            {t("wind", {
              bz: wind.bzAvg30.toFixed(1),
              speed: Math.round(wind.speed ?? 0),
            })}
          </>
        )}
      </p>
    </section>
  );
}