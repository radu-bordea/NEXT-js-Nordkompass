/**
 * Moon card on the Tonight page: phase, % lit, when it's up, and what it
 * means for aurora watching (dark sky / some moonlight / bright).
 * Data comes from moonTonight() in lib/moon.ts.
 */

import { useTranslations } from "next-intl";
import { Moon } from "lucide-react";
import type { MoonTonight } from "@/lib/moon";

// Color of the moon icon: brighter moon = more yellow
const ICON_COLOR = {
  dark: "text-slate-400",
  some: "text-amber-300",
  bright: "text-amber-400",
};

export function MoonCard({
  moon,
  timeFmt,
}: {
  moon: MoonTonight;
  timeFmt: Intl.DateTimeFormat; // same Norwegian-time formatter as the page
}) {
  const t = useTranslations("Moon");

  // When is it up? "Up all night" / "Below the horizon all night" / "Up 15:40–03:10"
  const when = moon.upAllNight
    ? t("upAllNight")
    : moon.neverUp || !moon.upFrom || !moon.upUntil
      ? t("neverUp")
      : t("upBetween", {
          from: timeFmt.format(moon.upFrom),
          to: timeFmt.format(moon.upUntil),
        });

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-5">
      <Moon
        className={`h-10 w-10 shrink-0 ${ICON_COLOR[moon.brightness]}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{t("title")}</p>
        <p className="mt-1 text-lg font-semibold">
          {t(`phase.${moon.phase}`)} · {t("lit", { lit: moon.lit })}
        </p>
        <p className="text-sm text-muted-foreground tabular-nums">{when}</p>
        <p className="text-sm text-muted-foreground">
          {t(`effect.${moon.brightness}`)}
        </p>
      </div>
    </div>
  );
}