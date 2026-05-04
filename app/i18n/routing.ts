import { defineRouting } from "next-intl/routing";

import { defaultLocale, localeCookieMaxAge, localeCookieName, locales } from "./config";

export const routing = defineRouting({
  defaultLocale,
  localeCookie: {
    maxAge: localeCookieMaxAge,
    name: localeCookieName,
    sameSite: "lax",
  },
  locales,
});
