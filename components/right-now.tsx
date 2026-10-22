import { useTranslations } from "next-intl";
import type { LiveStatus } from "@/lib/aurora-live";
import type { SolarWind } from "@/lib/sources/solar-wind";

const STYLES: Record<LiveStatus, string> = {
  go: "border-emerald-500/60 bg-emerald-500/10",
  maybe: "border-amber-500/60 bg-amber-500/10",
  wait: "border-border bg-card",
  cloudy: "border-border bg-card",
  daylight: "border-border bg-card",
};

const DOT: Record<LiveStatus, string> = {
  go: "bg-emerald-500",
  maybe: "bg-amber-500",
  wait: "bg-muted-foreground",
  cloudy: "bg-muted-foreground",
  daylight: "bg-muted-foreground",
};

const timeFmt = new Intl.DateTimeFormat("nb-NO", {
  timeZone: "Europe/Oslo",
  hour: "2-digit",
  minute: "2-digit",
});

type Props = {
  status: LiveStatus;
  live: boolean;            // false = OVATION failed, showing step 1 forecast
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

  return (
    <section className={`rounded-xl border p-5 ${STYLES[status]}`}>
      <p className="text-sm font-medium text-muted-foreground">{t("title")}</p>

      <div className="mt-1 flex items-center gap-3">
        <span className="relative flex size-3">
          {status === "go" && (
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75 motion-reduce:animate-none" />
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