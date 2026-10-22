/**
 * Moon card on the Tonight page: phase, % lit, when it's up, and what it
 * means for aurora watching (dark sky / some moonlight / bright).
 * Data comes from moonTonight() in lib/moon.ts.
 *
 * Two names for the phase:
 *   - big:   simple words everyone understands ("Almost full moon")
 *   - small: the astronomy term for experienced chasers ("Waxing gibbous")
 *     (hidden for new/full moon, where both names are the same)
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

  // The astronomy name only adds something when it differs from the simple one
  const showTechnical = moon.phase !== "new" && moon.phase !== "full";

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-5">
      <Moon
        className={`h-10 w-10 shrink-0 ${ICON_COLOR[moon.brightness]}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{t("title")}</p>

        {/* Simple name + % (for everyone) */}
        <p className="mt-1 text-lg font-semibold">
          {t(`phaseSimple.${moon.phase}`)} · {t("litShort", { lit: moon.lit })}
        </p>

        {/* Astronomy name (for experienced chasers and photographers) */}
        {showTechnical && (
          <p className="text-xs text-muted-foreground">
            {t(`phase.${moon.phase}`)}
          </p>
        )}

        <p className="mt-1 text-sm text-muted-foreground tabular-nums">{when}</p>
        <p className="text-sm text-muted-foreground">
          {t(`effect.${moon.brightness}`)}
        </p>
      </div>
    </div>
  );
}