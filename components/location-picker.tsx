/**
 * Area buttons (Bodø, Kjerringøy …) at the top of the Tonight and Forecast pages.
 * Server component: reads the list of areas straight from the database.
 */
import { Link } from "@/i18n/navigation";
import { listAreas } from "@/lib/areas";

export async function LocationPicker({
  current,
  basePath = "/tonight",
}: {
  current: string;
  basePath?: "/tonight" | "/forecast";
}) {
  const areas = await listAreas();

  return (
    <nav className="flex flex-wrap gap-2">
      {areas.map((area) => (
        <Link
          key={area.slug}
          href={`${basePath}/${area.slug}`}
          className={
            area.slug === current
              ? "rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
              : "rounded-full border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          }
        >
          {area.name}
        </Link>
      ))}
    </nav>
  );
}