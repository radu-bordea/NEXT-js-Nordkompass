import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const places: Record<string, string> = {
  bodo: "Bodø",
  saltstraumen: "Saltstraumen",
  kjerringoy: "Kjerringøy",
  svolvaer: "Svolvær",
};

export default async function TonightPage({
  params,
}: {
  params: Promise<{ location: string }>;
}) {
  const { location } = await params;
  const place = places[location];
  if (!place) notFound();

  const t = await getTranslations("Tonight");

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title", { place })}</h1>
      <div className="rounded-lg border bg-card p-6 text-muted-foreground">
        {t("placeholder")}
      </div>
    </section>
  );
}