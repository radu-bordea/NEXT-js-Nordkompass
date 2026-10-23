"use client";

/**
 * "Check my location" button (Tonight page)
 *
 * 1. Asks the browser for the visitor's position (the browser shows its own
 *    permission prompt; works only on https or localhost)
 * 2. Calls /api/now?lat=…&lon=… (app/api/now/route.ts)
 * 3. Shows the same "right now" answer as the spots, for that position
 *
 * Can be started by this card's button OR the "My location" button on the map
 * (the map sends the "nk:check-location" event).
 *
 * 4. Tells the map (components/spots-map.tsx) with a browser event
 *    "nk:my-location", so the map shows a "You are here" dot that pulses
 *    like the spots (maybe / go / storm)
 *
 * Nothing is stored. The position is shown so you can copy it to add a new
 * spot in lib/locations.ts (e.g. Alstad).
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { LocateFixed } from "lucide-react";
import type { LiveStatus, PulseLevel } from "@/lib/aurora-live";

/** Event the map listens to (see components/spots-map.tsx) */
export const MY_LOCATION_EVENT = "nk:my-location";

/** Event the map's "My location" button sends to start a check */
export const CHECK_LOCATION_EVENT = "nk:check-location";
export type MyLocationDetail = {
  lat: number;
  lon: number;
  status: LiveStatus;
  pulse: PulseLevel;
};

type Result = {
  lat: number;
  lon: number;
  status: LiveStatus;
  chance: number;
  cloud: number | null;
  strengthening: boolean;
  pulse: PulseLevel;
};

type State =
  | { kind: "idle" }
  | { kind: "locating" } // waiting for the browser's position
  | { kind: "loading" } // waiting for our API
  | { kind: "done"; result: Result }
  | { kind: "denied" | "unavailable" | "outside" | "error" };

// Text color per status (same meaning as the "Right now" card)
const STATUS_COLOR: Record<LiveStatus, string> = {
  storm: "text-fuchsia-600 dark:text-fuchsia-400",
  go: "text-emerald-600 dark:text-emerald-400",
  maybe: "text-sky-600 dark:text-sky-400",
  wait: "text-foreground",
  cloudy: "text-foreground",
  daylight: "text-foreground",
};

/**
 * DEV ONLY: ?pulseTest=maybe|go|storm in the URL also makes "You are here"
 * pulse (the spots use the same parameter on the server). Ignored in production.
 */
function testPulse(): PulseLevel {
  if (process.env.NODE_ENV === "production") return null;
  const value = new URLSearchParams(window.location.search).get("pulseTest");
  return value === "maybe" || value === "go" || value === "storm" ? value : null;
}

export function MyLocation() {
  const t = useTranslations("MyLocation");
  const tNow = useTranslations("Now");
  const [state, setState] = useState<State>({ kind: "idle" });

  function check() {
    if (!("geolocation" in navigator)) {
      setState({ kind: "unavailable" });
      return;
    }
    setState({ kind: "locating" });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setState({ kind: "loading" });
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`/api/now?lat=${latitude}&lon=${longitude}`);
          if (res.status === 400) return setState({ kind: "outside" });
          if (!res.ok) return setState({ kind: "error" });
          const result = (await res.json()) as Result;
          setState({ kind: "done", result });

          // Tell the map to show "You are here"
          const detail: MyLocationDetail = {
            lat: result.lat,
            lon: result.lon,
            status: result.status,
            pulse: testPulse() ?? result.pulse,
          };
          window.dispatchEvent(new CustomEvent(MY_LOCATION_EVENT, { detail }));
        } catch {
          setState({ kind: "error" });
        }
      },
      (err) => {
        // 1 = the visitor (or browser settings) said no
        setState({ kind: err.code === 1 ? "denied" : "error" });
      },
      {
        enableHighAccuracy: false, // ~100 m is plenty, and faster + less battery
        timeout: 10_000,
        maximumAge: 5 * 60 * 1000, // a position from the last 5 min is fine
      },
    );
  }

  const busy = state.kind === "locating" || state.kind === "loading";

  // The map's "My location" button → run the same check here
  // (ref so the listener always calls the latest check function)
  const checkRef = useRef(check);
  checkRef.current = check;
  useEffect(() => {
    const onCheck = () => checkRef.current();
    window.addEventListener(CHECK_LOCATION_EVENT, onCheck);
    return () => window.removeEventListener(CHECK_LOCATION_EVENT, onCheck);
  }, []);

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{t("title")}</p>
        <button
          type="button"
          onClick={check}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          {state.kind === "done" ? t("again") : t("button")}
        </button>
      </div>

      {/* Progress and problems */}
      {state.kind === "locating" && <p className="text-sm text-muted-foreground">{t("locating")}</p>}
      {state.kind === "loading" && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
      {state.kind === "denied" && <p className="text-sm text-muted-foreground">{t("denied")}</p>}
      {state.kind === "unavailable" && <p className="text-sm text-muted-foreground">{t("unavailable")}</p>}
      {state.kind === "outside" && <p className="text-sm text-muted-foreground">{t("outside")}</p>}
      {state.kind === "error" && <p className="text-sm text-muted-foreground">{t("error")}</p>}

      {/* The answer */}
      {state.kind === "done" && (
        <div className="flex flex-col gap-1" aria-live="polite">
          <p className={`text-xl font-semibold ${STATUS_COLOR[state.result.status]}`}>
            {tNow(state.result.status)}
          </p>
          {state.result.status !== "daylight" && (
            <p className="flex flex-wrap gap-x-4 text-sm">
              <span>{tNow("chance", { chance: state.result.chance })}</span>
              {state.result.cloud !== null && (
                <span>{tNow("cloud", { cloud: Math.round(state.result.cloud) })}</span>
              )}
            </p>
          )}
          {state.result.strengthening && state.result.status !== "daylight" && (
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {tNow("strengthening")}
            </p>
          )}
          <p className="text-xs text-muted-foreground tabular-nums">
            {t("position", { lat: state.result.lat, lon: state.result.lon })} · {t("assumption")}
          </p>
        </div>
      )}
    </section>
  );
}