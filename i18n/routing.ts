import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "no"],
  defaultLocale: "en",
  localePrefix: "as-needed",
  localeDetection: false,
});