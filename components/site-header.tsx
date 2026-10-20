import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

export async function SiteHeader() {
  const t = await getTranslations("Nav");

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold tracking-tight">
          Nordkompass
        </Link>

        <nav className="flex items-center gap-4 text-sm">
          <Link href="/tonight/bodo" className="text-muted-foreground hover:text-foreground">
            {t("tonight")}
          </Link>
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
            {t("dashboard")}
          </Link>
          <Suspense fallback={<div className="h-7 w-16" />}>
            <LanguageSwitcher />
          </Suspense>
          <ThemeToggle/>
          <Link
            href="/sign-in"
            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground hover:opacity-90"
          >
            {t("signIn")}
          </Link>
        </nav>
      </div>
    </header>
  );
}