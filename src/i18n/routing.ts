import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["fr", "en", "ja"],
  defaultLocale: "fr",
});

export type Locale = (typeof routing.locales)[number];
