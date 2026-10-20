// today's test routeimport { fetchMetForecast } from "@/lib/sources/met";
import { fetchMetForecast } from "@/lib/sources/met";

export async function GET() {
  try {
    const hours = await fetchMetForecast(67.2804, 14.4049); // Bodø
    return Response.json(hours.slice(0, 12));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}