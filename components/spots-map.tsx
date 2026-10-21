"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AuroraLevel } from "@/lib/aurora";

export type MapSpot = {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  level: AuroraLevel;
  levelLabel: string; // e.g. "High"
  detail: string; // e.g. "Best 22:00 · 5% cloud · Darkness 4/5"
  note: string;
};

const MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/fiord",
};

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

export function SpotsMap({ spots }: { spots: MapSpot[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const currentStyleRef = useRef<string | null>(null);
  const { resolvedTheme } = useTheme();
  const themeRef = useRef(resolvedTheme);
  themeRef.current = resolvedTheme;

  // Create the map once
  useEffect(() => {
    let cancelled = false;
    let createdMap: MapLibreMap | null = null;

    (async () => {
      const maplibregl = await import("maplibre-gl");
      maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
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
        attributionControl: { compact: true },
      });
      createdMap = map;

      // Runs each time a map style finishes loading, including after light/dark switches
      map.on("style.load", () => {
        if (themeRef.current !== "light") applyDarkTint(map);
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

      spots.forEach((s, i) => {
        const rank = i + 1; // same order as the list below the map

        // The numbered dot on the map
        const dot = document.createElement("button");
        dot.type = "button";
        dot.textContent = String(rank);
        dot.setAttribute("aria-label", `${rank}. ${s.name}`);
        dot.style.cssText = `width:28px;height:28px;border-radius:9999px;background:${LEVEL_COLORS[s.level]};border:2px solid #fff;box-shadow:0 0 0 2px rgba(0,0,0,.25);cursor:pointer;color:#fff;font:600 13px/1 system-ui,sans-serif;display:flex;align-items:center;justify-content:center;`;

        // The popup (built with textContent, never innerHTML)
        const popup = document.createElement("div");
        popup.style.cssText = "color:#0f172a;font-size:13px;line-height:1.4;max-width:220px;";
        const title = document.createElement("strong");
        title.textContent = `${rank}. ${s.name}`;
        const level = document.createElement("div");
        level.textContent = `${s.levelLabel} · ${s.detail}`;
        const note = document.createElement("div");
        note.style.cssText = "margin-top:4px;color:#475569;";
        note.textContent = s.note;
        popup.append(title, level, note);

        new maplibregl.Marker({ element: dot })
          .setLngLat([s.lon, s.lat])
          .setPopup(new maplibregl.Popup({ offset: 16 }).setDOMContent(popup))
          .addTo(map);
      });

      // Zoom to show all spots
      if (spots.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        spots.forEach((s) => bounds.extend([s.lon, s.lat]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 0 });
      }

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current && mapRef.current !== createdMap) mapRef.current.remove();
      createdMap?.remove();
      mapRef.current = null;
    };
  }, [spots]);

  // Switch map style when light/dark changes
  useEffect(() => {
    const map = mapRef.current;
    const style = styleFor(resolvedTheme);
    if (!map || style === currentStyleRef.current) return;
    currentStyleRef.current = style;
    map.setStyle(style);
  }, [resolvedTheme]);

  return (
    <div
      ref={containerRef}
      className="h-80 w-full overflow-hidden rounded-lg border sm:h-96"
      role="region"
      aria-label="Map of viewing spots"
    />
  );
}