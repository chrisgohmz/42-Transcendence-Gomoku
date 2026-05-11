"use client";

import { Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { locales, type Locale } from "@/i18n/config";
import { usePathname, useRouter } from "@/i18n/navigation";

const shortLabels: Record<string, string> = {
  en: "EN",
  ja: "JA",
  zh: "ZH",
};

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex cursor-pointer items-center gap-2">
          <Globe className="h-4 w-4 text-[var(--brass)]" />
          <span>{shortLabels[locale] || locale.toUpperCase()}</span>
          <span className="sr-only">{t("languageLabel")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="z-[100]">
        {locales.map((availableLocale) => (
          <DropdownMenuItem
            key={availableLocale}
            onClick={() => handleLocaleChange(availableLocale as Locale)}
            className={`cursor-pointer ${locale === availableLocale ? "text-primary font-bold" : ""}`}
          >
            {localeNames(availableLocale)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
