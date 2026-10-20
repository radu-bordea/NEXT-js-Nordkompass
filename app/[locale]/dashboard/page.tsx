import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const t = await getTranslations("Dashboard");

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <div className="rounded-lg border bg-card p-6 text-muted-foreground">
        {t("placeholder")}
      </div>
    </section>
  );
}