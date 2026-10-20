import { Link } from "@/i18n/navigation";
import { locations } from "@/lib/locations";

export function LocationPicker({ current }: { current: string }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {Object.entries(locations).map(([slug, loc]) => (
        <Link
          key={slug}
          href={`/tonight/${slug}`}
          className={
            slug === current
              ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
              : "rounded-full border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          }
        >
          {loc.name}
        </Link>
      ))}
    </nav>
  );
}