import "server-only";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { defaultLocale, locales, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";

type MetadataMessages = Messages["metadata"];
export type MetadataPageKey = keyof MetadataMessages["pages"];
type StaticMetadataPageKey = Exclude<MetadataPageKey, "publicProfile">;

export type PageMetadataProps = {
  params: Promise<{
    locale: string;
  }>;
};

const staticPagePaths = {
  ai: "/ai",
  editProfile: "/profile/edit",
  forgotPassword: "/forgot-password",
  friends: "/friends",
  home: "/",
  human: "/human",
  leaderboard: "/leaderboard",
  login: "/login",
  messages: "/messages",
  privacy: "/privacy",
  profile: "/profile",
  resetPassword: "/reset-password",
  signup: "/signup",
  status: "/status",
  terms: "/terms",
} as const satisfies Record<StaticMetadataPageKey, `/${string}`>;

const noIndexPages = new Set<MetadataPageKey>([
  "editProfile",
  "forgotPassword",
  "friends",
  "messages",
  "profile",
  "resetPassword",
  "status",
]);

const openGraphLocales = {
  en: "en_US",
  ja: "ja_JP",
  zh: "zh_CN",
} as const satisfies Record<Locale, string>;

type BuildMetadataOptions = {
  locale: string;
  page: MetadataPageKey;
  path: `/${string}`;
  values?: Record<string, string>;
  noIndex?: boolean;
};

export function createPageMetadata(
  page: StaticMetadataPageKey,
  path: `/${string}` = staticPagePaths[page],
) {
  return async function generateMetadata({ params }: PageMetadataProps): Promise<Metadata> {
    const { locale } = await params;

    return buildPageMetadata({
      locale,
      page,
      path,
    });
  };
}

export async function buildPageMetadata({
  locale,
  page,
  path,
  values,
  noIndex = noIndexPages.has(page),
}: BuildMetadataOptions): Promise<Metadata> {
  const resolvedLocale = resolveLocale(locale);
  const t = await getTranslations({ locale: resolvedLocale, namespace: "metadata" });
  const appName = t("appName");
  const pageTitle = t(`pages.${page}.title`, values);
  const description = t(`pages.${page}.description`, values);
  const title = t("titleTemplate", {
    appName,
    pageTitle,
  });
  const alternates = getAlternates(path, resolvedLocale);

  return {
    alternates,
    description,
    openGraph: {
      alternateLocale: locales
        .filter((candidate) => candidate !== resolvedLocale)
        .map((candidate) => openGraphLocales[candidate]),
      description,
      locale: openGraphLocales[resolvedLocale],
      siteName: appName,
      title,
      type: "website",
      url: alternates.canonical,
    },
    robots: noIndex ? { follow: false, index: false } : undefined,
    title,
    twitter: {
      card: "summary",
      description,
      title,
    },
  };
}

export function getRootMetadataBase(): URL {
  const configuredUrl =
    process.env["NEXT_PUBLIC_APP_URL"] ?? process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000";

  try {
    return new URL(configuredUrl);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export function getLocaleOpenGraphLocale(locale: string): string {
  return openGraphLocales[resolveLocale(locale)];
}

function getAlternates(path: `/${string}`, locale: Locale) {
  return {
    canonical: getLocalizedPath(locale, path),
    languages: Object.fromEntries(
      locales.map((candidate) => [candidate, getLocalizedPath(candidate, path)]),
    ),
  };
}

function getLocalizedPath(locale: Locale, path: `/${string}`) {
  return `/${locale}${path === "/" ? "" : path}`;
}

function resolveLocale(locale: string): Locale {
  return locales.includes(locale as Locale) ? (locale as Locale) : defaultLocale;
}
