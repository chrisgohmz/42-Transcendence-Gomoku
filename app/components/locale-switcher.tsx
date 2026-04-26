"use client";

import { useLocale, useTranslations } from "next-intl";

import { locales, type Locale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const localeNames = useTranslations("nav.localeNames");

  function handleLocaleChange(nextLocale: Locale) {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <label className="locale-switcher">
      <span className="sr-only">{t("languageLabel")}</span>
      <select
        aria-label={t("languageLabel")}
        value={locale}
        onChange={(event) => handleLocaleChange(event.target.value as Locale)}
      >
        {locales.map((availableLocale) => (
          <option key={availableLocale} value={availableLocale}>
            {localeNames(availableLocale)}
          </option>
        ))}
      </select>
    </label>
  );
}
