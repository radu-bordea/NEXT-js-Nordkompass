import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader() {
  const t = await getTranslations("Nav");

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        {/* Logo */}
        <Link href="/" className="font-semibold tracking-tight">
          Nordkompass
        </Link>

        {/* Links: own row on phones, inline from tablet up */}
        <nav className="order-last flex w-full items-center gap-5 text-sm sm:order-none sm:w-auto sm:flex-1">
          <Link href="/tonight/bodo" className="text-muted-foreground hover:text-foreground">
            {t("tonight")}
          </Link>
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            {t("dashboard")}
          </Link>
        </nav>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Suspense fallback={<div className="h-7 w-16" />}>
            <LanguageSwitcher />
          </Suspense>
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            {t("signIn")}
          </Link>
        </div>
      </div>
    </header>
  );
}