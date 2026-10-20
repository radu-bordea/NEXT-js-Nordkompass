import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { locations } from "@/lib/locations";

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
        <div>
          <Link
            href="/tonight/bodo"
            className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
          >
            {t("cta")}
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("pickPlace")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Object.entries(locations).map(([slug, loc]) => (
            <Link
              key={slug}
              href={`/tonight/${slug}`}
              className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-colors hover:bg-muted"
            >
              <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="font-medium">{loc.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}