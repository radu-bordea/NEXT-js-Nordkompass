"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation"

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 text-sm">
      {(["en", "no"] as const).map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          className={
            l === locale
              ? "rounded-md bg-muted px-2 py-1 font-medium text-foreground"
              : "rounded-md px-2 py-1 text-muted-foreground hover:text-foreground"
          }
        >
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}