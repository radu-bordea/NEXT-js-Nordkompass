import { cpSync, mkdirSync } from "node:fs";

// Copies MapLibre's worker file into public/, so the browser can load it.
// Runs automatically after every npm install, so it always matches the installed version.
mkdirSync("public/maplibre", { recursive: true });

for (const file of ["maplibre-gl-worker.mjs"]) {
  cpSync(`node_modules/maplibre-gl/dist/${file}`, `public/maplibre/${file}`);
}

console.log("Copied MapLibre worker file to public/maplibre");