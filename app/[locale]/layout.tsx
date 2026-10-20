import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/site-header";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    title: { default: t("title"), template: "%s · Nordkompass" },
    description: t("description"),
    applicationName: "Nordkompass",
    alternates: { canonical: `/${locale}`, languages: { en: "/en", no: "/no" } },
    openGraph: {
      title: "Nordkompass",
      description: t("description"),
      siteName: "Nordkompass",
      locale: locale === "no" ? "nb_NO" : "en_GB",
      type: "website",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider>
          <SiteHeader />
          <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}