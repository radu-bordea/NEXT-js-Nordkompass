"use client";

/**
 * Spots map (MapLibre)
 *
 * Layers, bottom to top:
 *  1. Base map (OpenFreeMap positron = light, fiord = dark, tinted to match the site)
 *  2. Aurora glow: NOAA OVATION values painted as an image (lib/glow.ts)
 *     (color = value: faint green → green → mint → pink for storms)
 *  3. Place labels (glow is inserted under them so town names stay readable)
 *  4. Numbered spot dots (HTML markers, always on top) with pulse waves:
 *     maybe = 1 slow blue ring, go = 3 green waves, storm = 3 fast pink waves
 *     (wave styles: .nk-wave in app/globals.css)
 *
 *  5. "You are here" dot (blue, white border) after "Check my location",
 *     pulsing at its own live level. Listens for the "nk:my-location" event
 *     sent by components/my-location.tsx.
 *
 * Controls (top-left): "Aurora layer" on/off, "Show region" / "Back to spots",
 * and "My location" (asks the MyLocation card under the map to run its check).
 * Legend (bottom-left): Weak → Strong + update time.
 *
 * Glow vs pulse:
 *  - Glow  = where the aurora is active (OVATION only, ignores clouds)
 *  - Pulse = you can see it at THIS spot right now (aurora + clear sky + dark)
 */

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import type { ImageSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AuroraLevel } from "@/lib/aurora";
import type { AuroraPoint } from "@/lib/sources/ovation";
import type { PulseLevel } from "@/lib/aurora-live";
import {
  CHECK_LOCATION_EVENT,
  MY_LOCATION_EVENT,
  type MyLocationDetail,
} from "@/components/my-location";
import { LocateFixed } from "lucide-react";
import { directionsUrl } from "@/lib/directions";

type MapLibreModule = typeof import("maplibre-gl");
import { buildGlowImage, GLOW_COORDINATES } from "@/lib/glow";

export type MapSpot = {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  level: AuroraLevel;
  levelLabel: string; // e.g. "High"
  detail: string; // e.g. "Best 22:00 · 5% cloud · Darkness 4/5"
  note: string;
  pulse: PulseLevel; // "maybe" | "go" | "storm" | null (no pulse)
};

type Props = {
  spots: MapSpot[];
  glow?: AuroraPoint[]; // OVATION points for the glow layer
  glowOn?: boolean; // default visibility (on at night, off in daylight)
  glowUpdated?: string | null; // e.g. "11:30"
};

// ======================================================================
// BASE MAP
// ======================================================================

const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/fiord",
};

// Dot colors per aurora level (same meaning as the badges on the page)
const LEVEL_COLORS: Record<AuroraLevel, string> = {
  high: "#10b981",
  possible: "#0ea5e9",
  low: "#94a3b8",
  none: "#64748b",
  daylight: "#f59e0b",
};

function styleFor(theme: string | undefined) {
  return theme === "light" ? MAP_STYLES.light : MAP_STYLES.dark;
}

// Recolour the dark map to match the site's theme
const DARK_TINT = {
  land: "#305159",
  water: "#102322",
};

function applyDarkTint(map: MapLibreMap) {
  try {
    map.setPaintProperty("background", "background-color", DARK_TINT.land);
    map.setPaintProperty("water", "fill-color", DARK_TINT.water);
  } catch {
    // If the style ever renames these layers, keep the original colours
  }
}

// ======================================================================
// VIEWS (spots ↔ region)
// ======================================================================

// "Show region": Trøndelag → Tromsø/Finnmark, incl. Lofoten and Sweden/Finland
const REGION_BOUNDS: [[number, number], [number, number]] = [
  [4, 64.5], // south-west [lon, lat]
  [24, 71.5], // north-east
];

// How far users can zoom out (3.5 ≈ all of Scandinavia). Nobody needs the whole world.
const MIN_ZOOM = 3.5;

/** Zoom to the spots (all of them, or the single one) */
function fitSpots(map: MapLibreMap, spots: MapSpot[], duration: number) {
  if (spots.length > 1) {
    const lons = spots.map((s) => s.lon);
    const lats = spots.map((s) => s.lat);
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 60, maxZoom: 12, duration },
    );
  } else if (spots.length === 1) {
    map.flyTo({ center: [spots[0].lon, spots[0].lat], zoom: 11, duration });
  }
}

// ======================================================================
// AURORA GLOW (image layer)
// ======================================================================

const GLOW_SOURCE = "aurora-glow";
const GLOW_LAYER = "aurora-glow-image";

/**
 * Adds the glow image + raster layer. Must run after every style load,
 * because map.setStyle() (light/dark switch) removes all custom layers.
 * The image itself is painted in lib/glow.ts (color = OVATION value).
 */
function addGlowLayer(
  map: MapLibreMap,
  points: AuroraPoint[],
  visible: boolean,
  dark: boolean,
) {
  if (map.getSource(GLOW_SOURCE)) return; // already added

  map.addSource(GLOW_SOURCE, {
    type: "image",
    url: buildGlowImage(points, dark),
    coordinates: GLOW_COORDINATES, // image corners on the map
  });

  // Put the glow under the first label layer so place names stay on top
  const firstLabel = map
    .getStyle()
    .layers?.find((l) => l.type === "symbol")?.id;

  map.addLayer(
    {
      id: GLOW_LAYER,
      type: "raster",
      source: GLOW_SOURCE,
      layout: { visibility: visible ? "visible" : "none" },
      paint: {
        "raster-opacity": 1, // transparency is already in the image
        "raster-resampling": "linear", // smooth when zoomed in, no pixels
        "raster-fade-duration": 0,
      },
    },
    firstLabel,
  );
}

// ======================================================================
// "YOU ARE HERE" (after "Check my location")
// ======================================================================

/** Adds a pulse ring set (same CSS as the spots) inside a marker element */
function addWaves(el: HTMLElement, pulse: PulseLevel) {
  if (!pulse) return;
  const waves = pulse === "maybe" ? [1] : [1, 2, 3];
  for (const n of waves) {
    const wave = document.createElement("span");
    wave.className = `nk-wave nk-wave--${pulse} nk-wave--${n}`;
    el.appendChild(wave);
  }
}

/**
 * Creates or moves the "You are here" marker.
 * Blue like a phone's map app, so it never looks like a numbered spot.
 */
function placeMe(
  lib: MapLibreModule,
  map: MapLibreMap,
  existing: Marker | null,
  me: MyLocationDetail,
  label: string,
): Marker {
  existing?.remove();

  const el = document.createElement("div");
  el.className = "nk-dot";
  el.setAttribute("aria-label", label);
  el.style.cssText =
    "width:18px;height:18px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px rgba(37,99,235,.35),0 1px 4px rgba(0,0,0,.35);";
  addWaves(el, me.pulse);

  const popup = document.createElement("div");
  popup.style.cssText = "color:#0f172a;font-size:13px;line-height:1.4;";
  popup.textContent = label;

  return new lib.Marker({ element: el })
    .setLngLat([me.lon, me.lat])
    .setPopup(new lib.Popup({ offset: 14 }).setDOMContent(popup))
    .addTo(map);
}

/** Zoom so both the spots and "you" are visible */
function fitSpotsAndMe(map: MapLibreMap, spots: MapSpot[], me: MyLocationDetail) {
  const lons = [...spots.map((s) => s.lon), me.lon];
  const lats = [...spots.map((s) => s.lat), me.lat];
  map.fitBounds(
    [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ],
    { padding: 60, maxZoom: 12, duration: 800 },
  );
}

// ======================================================================
// COMPONENT
// ======================================================================

export function SpotsMap({
  spots,
  glow = [],
  glowOn = true,
  glowUpdated = null,
}: Props) {
  const t = useTranslations("Map");
  const tNow = useTranslations("Now");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const currentStyleRef = useRef<string | null>(null);

  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);
  themeRef.current = resolvedTheme;

  // UI state: glow visible? zoomed to spots or region?
  const [showGlow, setShowGlow] = useState(glowOn);
  const [view, setView] = useState<"spots" | "region">("spots");

  // Refs so the map's "style.load" handler always sees the latest values
  // (the handler is created once, so it can't read fresh props/state directly)
  const glowRef = useRef(glow);
  const showGlowRef = useRef(showGlow);

  // "You are here": the loaded MapLibre module, the marker, and the last position
  const libRef = useRef<MapLibreModule | null>(null);
  const meMarkerRef = useRef<Marker | null>(null);
  const meRef = useRef<MyLocationDetail | null>(null);
  const meLabel = (me: MyLocationDetail) => `${t("you")} · ${tNow(me.status)}`;

  // When night starts/ends (page auto-refresh), follow the new default
  useEffect(() => setShowGlow(glowOn), [glowOn]);

  // ---------- create the map once (recreated only when spots change) ----------
  useEffect(() => {
    let cancelled = false;
    let createdMap: MapLibreMap | null = null;

    (async () => {
      // Load MapLibre only in the browser (it needs window/WebGL)
      const maplibregl = await import("maplibre-gl");
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      libRef.current = maplibregl;
      if (cancelled || !containerRef.current || spots.length === 0) return;

      // Remove any map left over from a previous run (dev reloads, StrictMode)
      mapRef.current?.remove();
      mapRef.current = null;

      const style = styleFor(themeRef.current);
      currentStyleRef.current = style;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [spots[0].lon, spots[0].lat],
        zoom: 11,
        minZoom: MIN_ZOOM,
        attributionControl: { compact: true },
      });
      createdMap = map;

      // Runs each time a map style finishes loading, including after light/dark switches
      map.on("style.load", () => {
        const dark = themeRef.current !== "light";
        if (dark) applyDarkTint(map);
        addGlowLayer(map, glowRef.current, showGlowRef.current, dark);
      });

      // Zoom buttons (top-right)
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );

      spots.forEach((s, i) => {
        const rank = i + 1; // same order as the list below the map

        // The numbered dot on the map
        const dot = document.createElement("button");
        dot.type = "button";
        dot.textContent = String(rank);
        dot.className = "nk-dot";
        dot.setAttribute("aria-label", `${rank}. ${s.name}`);
        dot.style.cssText = `width:28px;height:28px;border-radius:9999px;background:${LEVEL_COLORS[s.level]};border:2px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.25);cursor:pointer;color:#fff;font:600 13px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;`;

        // Pulse waves (CSS in globals.css):
        //   maybe → 1 slow blue ring, go → 3 green waves, storm → 3 fast pink waves
        addWaves(dot, s.pulse);

        // The popup (built with textContent, never innerHTML → safe from injection)
        const popup = document.createElement("div");
        popup.style.cssText =
          "color:#0f172a;font-size:13px;line-height:1.4;max-width:220px;";
        const title = document.createElement("strong");
        title.textContent = `${rank}. ${s.name}`;
        const level = document.createElement("div");
        level.textContent = `${s.levelLabel} · ${s.detail}`;
        const note = document.createElement("div");
        note.style.cssText = "margin-top:4px;color:#475569;";
        note.textContent = s.note;

        // "Directions": opens Google Maps on the phone with this spot as destination
        const directions = document.createElement("a");
        directions.href = directionsUrl(s.lat, s.lon);
        directions.target = "_blank";
        directions.rel = "noopener noreferrer";
        directions.textContent = `🧭 ${t("directions")}`;
        directions.style.cssText =
          "display:inline-block;margin-top:6px;font-weight:600;color:#2563eb;text-decoration:none;";

        popup.append(title, level, note, directions);

        new maplibregl.Marker({ element: dot })
          .setLngLat([s.lon, s.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setDOMContent(popup))
          .addTo(map);
      });

      // Start zoomed in on the spots
      fitSpots(map, spots, 0);
      setView("spots");

      // Map was rebuilt (e.g. new spots) → put "You are here" back if we had it
      meMarkerRef.current = meRef.current
        ? placeMe(maplibregl, map, null, meRef.current, meLabel(meRef.current))
        : null;

      mapRef.current = map;
    })();

    // Cleanup when the component unmounts or spots change
    return () => {
      cancelled = true;
      if (mapRef.current && mapRef.current !== createdMap)
        mapRef.current.remove();
      createdMap?.remove();
      mapRef.current = null;
    };
  }, [spots]);

  // ---------- "Check my location" result → show "You are here" ----------
  useEffect(() => {
    function onMyLocation(event: Event) {
      const me = (event as CustomEvent<MyLocationDetail>).detail;
      meRef.current = me;
      const map = mapRef.current;
      const lib = libRef.current;
      if (!map || !lib) return; // map not ready yet; added when it is
      meMarkerRef.current = placeMe(lib, map, meMarkerRef.current, me, meLabel(me));
      fitSpotsAndMe(map, spots, me);
      setView("spots");
    }
    window.addEventListener(MY_LOCATION_EVENT, onMyLocation);
    return () => window.removeEventListener(MY_LOCATION_EVENT, onMyLocation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots]);

  // ---------- switch map style when light/dark changes ----------
  useEffect(() => {
    const map = mapRef.current;
    const style = styleFor(resolvedTheme);
    if (!map || style === currentStyleRef.current) return;
    currentStyleRef.current = style;
    map.setStyle(style); // → "style.load" fires again → tint + glow re-added
  }, [resolvedTheme]);

  // ---------- new OVATION data (every page refresh) → repaint glow without rebuilding the map ----------
  useEffect(() => {
    glowRef.current = glow;
    const source = mapRef.current?.getSource(GLOW_SOURCE) as
      | ImageSource
      | undefined;
    source?.updateImage({
      url: buildGlowImage(glow, themeRef.current !== "light"),
      coordinates: GLOW_COORDINATES,
    });
  }, [glow]);

  // ---------- show/hide glow ----------
  useEffect(() => {
    showGlowRef.current = showGlow;
    const map = mapRef.current;
    if (map?.getLayer(GLOW_LAYER)) {
      map.setLayoutProperty(
        GLOW_LAYER,
        "visibility",
        showGlow ? "visible" : "none",
      );
    }
  }, [showGlow]);

  // ---------- "Show region" / "Back to spots" ----------
  function toggleView() {
    const map = mapRef.current;
    if (!map) return;
    if (view === "spots") {
      map.fitBounds(REGION_BOUNDS, { padding: 20, duration: 800 });
      setView("region");
    } else {
      fitSpots(map, spots, 800);
      setView("spots");
    }
  }

  const buttonClass =
    "rounded-md border bg-background/90 px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur transition hover:bg-background";

  return (
    <div className="relative">
      {/* The map itself */}
      <div
        ref={containerRef}
        className="h-80 w-full overflow-hidden rounded-lg border sm:h-96"
        role="region"
        aria-label="Map of viewing spots"
      />

      {/* Controls (top-left; zoom buttons are top-right) */}
      <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setShowGlow((v) => !v)}
          aria-pressed={showGlow}
          className={`${buttonClass} ${showGlow ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}
        >
          <span
            className={`mr-1.5 inline-block h-2 w-2 rounded-full ${showGlow ? "bg-emerald-500" : "bg-muted-foreground/50"}`}
          />
          {t("auroraLayer")}
        </button>
        <button type="button" onClick={toggleView} className={buttonClass}>
          {view === "spots" ? t("showRegion") : t("showSpots")}
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(CHECK_LOCATION_EVENT))}
          className={`${buttonClass} inline-flex items-center gap-1.5`}
        >
          <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
          {t("myLocation")}
        </button>
      </div>

      {/* Legend (bottom-left; attribution is bottom-right) */}
      {showGlow && (
        <div className="absolute bottom-2 left-2 z-10 rounded-md border bg-background/90 px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <span>{t("glowLow")}</span>
            {/* Same colors as lib/glow.ts: faint green → green → mint → pink (storm) */}
            <span
              className="h-2 w-16 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, rgba(16,185,129,0.15), rgba(16,185,129,0.45), rgba(52,211,153,0.8), rgba(217,70,239,0.8))",
              }}
            />
            <span>{t("glowHigh")}</span>
          </div>
          {glowUpdated && (
            <div className="mt-0.5 text-muted-foreground">
              {t("glowUpdated", { time: glowUpdated })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}