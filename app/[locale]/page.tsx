import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function HomePage() {
  const t = await getTranslations("Home");

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      <div>
        <Link
          href="/tonight/bodo"
          className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
        >
          {t("cta")}
        </Link>
      </div>
    </section>
  );
}