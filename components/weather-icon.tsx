import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudHail,
  CloudLightning,
  type LucideIcon,
} from "lucide-react";

function pickIcon(symbol: string | null): { Icon: LucideIcon; color: string } {
  if (!symbol) return { Icon: Cloud, color: "text-muted-foreground" };

  const night = symbol.endsWith("_night") || symbol.endsWith("_polartwilight");

  if (symbol.includes("thunder")) return { Icon: CloudLightning, color: "text-violet-500" };
  if (symbol.includes("sleet")) return { Icon: CloudHail, color: "text-sky-400" };
  if (symbol.includes("snow")) return { Icon: CloudSnow, color: "text-sky-300" };
  if (symbol.startsWith("light") && symbol.includes("rain"))
    return { Icon: CloudDrizzle, color: "text-sky-500" };
  if (symbol.includes("rain")) return { Icon: CloudRain, color: "text-sky-500" };
  if (symbol.startsWith("fog")) return { Icon: CloudFog, color: "text-muted-foreground" };
  if (symbol.startsWith("cloudy")) return { Icon: Cloud, color: "text-muted-foreground" };
  if (symbol.startsWith("partlycloudy") || symbol.startsWith("fair"))
    return night
      ? { Icon: CloudMoon, color: "text-indigo-400" }
      : { Icon: CloudSun, color: "text-amber-500" };
  if (symbol.startsWith("clearsky"))
    return night
      ? { Icon: Moon, color: "text-indigo-300" }
      : { Icon: Sun, color: "text-amber-500" };

  return { Icon: Cloud, color: "text-muted-foreground" };
}

export function WeatherIcon({
  symbol,
  className = "h-6 w-6",
}: {
  symbol: string | null;
  className?: string;
}) {
  const { Icon, color } = pickIcon(symbol);
  return <Icon className={`${className} ${color}`} strokeWidth={1.75} aria-hidden="true" />;
}