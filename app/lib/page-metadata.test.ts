import { afterEach, describe, expect, mock, test } from "bun:test";

import { messages as enMessages } from "@/i18n/messages/en";
import { messages as jaMessages } from "@/i18n/messages/ja";
import { messages as zhMessages } from "@/i18n/messages/zh";

const messagesByLocale = {
  en: enMessages,
  ja: jaMessages,
  zh: zhMessages,
};

type Locale = keyof typeof messagesByLocale;
type MessageValue = string | { [key: string]: MessageValue };

await mock.module("server-only", () => ({}));

await mock.module("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: Locale; namespace: string }) => {
    const namespaceMessages = getMessageValue(messagesByLocale[locale], namespace);

    return (key: string, values?: Record<string, string>) => {
      const value = getMessageValue(namespaceMessages, key);

      if (typeof value !== "string") {
        throw new Error(`Expected string message for ${namespace}.${key}`);
      }

      return interpolate(value, values);
    };
  },
}));

const { buildPageMetadata, createPageMetadata, getRootMetadataBase } =
  await import("./page-metadata");

function getMessageValue(source: MessageValue, key: string): MessageValue {
  return key.split(".").reduce<MessageValue>((current, segment) => {
    if (typeof current !== "object" || current === null || !(segment in current)) {
      throw new Error(`Missing message key: ${key}`);
    }

    return current[segment] as MessageValue;
  }, source);
}

function interpolate(message: string, values: Record<string, string> = {}) {
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) => values[key] ?? placeholder);
}

describe("buildPageMetadata", () => {
  test("builds localized public metadata with canonical and language alternates", async () => {
    const metadata = await buildPageMetadata({
      locale: "zh",
      page: "terms",
      path: "/terms",
    });

    expect(metadata.title).toBe("服务条款 | 五子棋英雄");
    expect(metadata.description).toBe("阅读账户访问、公平对局和规则执行相关条款。");
    expect(metadata.alternates).toEqual({
      canonical: "/zh/terms",
      languages: {
        en: "/en/terms",
        ja: "/ja/terms",
        zh: "/zh/terms",
      },
    });
    expect(metadata.openGraph).toMatchObject({
      alternateLocale: ["en_US", "ja_JP"],
      description: "阅读账户访问、公平对局和规则执行相关条款。",
      locale: "zh_CN",
      siteName: "五子棋英雄",
      title: "服务条款 | 五子棋英雄",
      type: "website",
      url: "/zh/terms",
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary",
      description: "阅读账户访问、公平对局和规则执行相关条款。",
      title: "服务条款 | 五子棋英雄",
    });
    expect(metadata.robots).toBeUndefined();
  });

  test("marks private utility routes noindex", async () => {
    const metadata = await buildPageMetadata({
      locale: "en",
      page: "editProfile",
      path: "/profile/edit",
    });

    expect(metadata.title).toBe("Edit Profile | Gomoku Heroes");
    expect(metadata.robots).toEqual({ follow: false, index: false });
  });

  test("falls back to the default locale for unsupported locale params", async () => {
    const metadata = await buildPageMetadata({
      locale: "fr",
      page: "human",
      path: "/human",
    });

    expect(metadata.title).toBe("vs Human | Gomoku Heroes");
    expect(metadata.alternates).toMatchObject({
      canonical: "/en/human",
    });
    expect(metadata.openGraph).toMatchObject({
      locale: "en_US",
      siteName: "Gomoku Heroes",
    });
  });

  test("formats dynamic public profile titles and encoded paths", async () => {
    const metadata = await buildPageMetadata({
      locale: "en",
      page: "publicProfile",
      path: "/profile/Ada%20Lovelace",
      values: {
        username: "Ada Lovelace",
      },
    });

    expect(metadata.title).toBe("@Ada Lovelace's Profile | Gomoku Heroes");
    expect(metadata.description).toBe(
      "View @Ada Lovelace's Gomoku rating, match history, and achievements.",
    );
    expect(metadata.alternates).toMatchObject({
      canonical: "/en/profile/Ada%20Lovelace",
      languages: {
        en: "/en/profile/Ada%20Lovelace",
        ja: "/ja/profile/Ada%20Lovelace",
        zh: "/zh/profile/Ada%20Lovelace",
      },
    });
  });
});

describe("createPageMetadata", () => {
  test("uses the static route path table for page canonical URLs", async () => {
    const generateMetadata = createPageMetadata("leaderboard");
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "ja" }),
    });

    expect(metadata.title).toBe("ランキング | 五目並べヒーローズ");
    expect(metadata.alternates).toMatchObject({
      canonical: "/ja/leaderboard",
    });
  });

  test("supports explicit route path overrides for alternate page entrypoints", async () => {
    const generateMetadata = createPageMetadata("home", "/home");
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: "en" }),
    });

    expect(metadata.title).toBe("Home | Gomoku Heroes");
    expect(metadata.alternates).toMatchObject({
      canonical: "/en/home",
    });
  });
});

describe("getRootMetadataBase", () => {
  const originalNextPublicAppUrl = process.env["NEXT_PUBLIC_APP_URL"];
  const originalBetterAuthUrl = process.env["BETTER_AUTH_URL"];

  afterEach(() => {
    if (originalNextPublicAppUrl === undefined) {
      delete process.env["NEXT_PUBLIC_APP_URL"];
    } else {
      process.env["NEXT_PUBLIC_APP_URL"] = originalNextPublicAppUrl;
    }

    if (originalBetterAuthUrl === undefined) {
      delete process.env["BETTER_AUTH_URL"];
    } else {
      process.env["BETTER_AUTH_URL"] = originalBetterAuthUrl;
    }
  });

  test("prefers NEXT_PUBLIC_APP_URL for absolute metadata composition", () => {
    process.env["NEXT_PUBLIC_APP_URL"] = "https://gomoku.example";
    process.env["BETTER_AUTH_URL"] = "https://auth.example";

    expect(getRootMetadataBase().toString()).toBe("https://gomoku.example/");
  });

  test("falls back to localhost when configured metadata base is invalid", () => {
    process.env["NEXT_PUBLIC_APP_URL"] = "not a url";
    delete process.env["BETTER_AUTH_URL"];

    expect(getRootMetadataBase().toString()).toBe("http://localhost:3000/");
  });
});
