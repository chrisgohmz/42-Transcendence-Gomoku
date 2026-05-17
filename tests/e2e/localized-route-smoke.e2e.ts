import { expect, type ConsoleMessage, type Page, test } from "@playwright/test";

import { locales, type Locale } from "../../app/i18n/config";
import { messages as enMessages } from "../../app/i18n/messages/en";
import { messages as jaMessages } from "../../app/i18n/messages/ja";
import { messages as zhMessages } from "../../app/i18n/messages/zh";

type AppMessages = typeof enMessages;

test.describe.configure({ mode: "serial" });
test.skip(
  ({ isMobile }) => isMobile,
  "Localized route smoke is browser-agnostic; existing smoke coverage exercises mobile layout.",
);

const messagesByLocale: Record<Locale, AppMessages> = {
  en: enMessages,
  ja: jaMessages,
  zh: zhMessages,
};

const activeSessionKey = "match:session:v1:active";
const activeMatchId = "localized-match";
const activeParticipantId = "localized-player";
const translationFailurePattern =
  /MISSING_MESSAGE|IntlError|Missing message|Could not resolve|Failed to format message/i;

const publicRouteCases = [
  {
    path: "/home",
    heading: (messages: AppMessages) => messages.home.dashboard.hero.title,
    visibleText: (messages: AppMessages) => messages.home.dashboard.snapshot.title,
  },
  {
    path: "/login",
    heading: (messages: AppMessages) => messages.auth.login.page.hero.title,
    visibleText: (messages: AppMessages) => messages.auth.login.title,
  },
  {
    path: "/signup",
    heading: (messages: AppMessages) => messages.auth.signup.title,
    visibleText: (messages: AppMessages) => messages.auth.signup.page.hero.badge,
  },
  {
    path: "/leaderboard",
    heading: (messages: AppMessages) => messages.leaderboard.title,
    visibleText: (messages: AppMessages) => messages.leaderboard.page.overview.title,
  },
  {
    path: "/terms",
    heading: (messages: AppMessages) => messages.legal.terms.title,
    visibleText: (messages: AppMessages) => messages.legal.terms.sections.enforcement.title,
  },
  {
    path: "/privacy",
    heading: (messages: AppMessages) => messages.legal.privacy.title,
    visibleText: (messages: AppMessages) => messages.legal.privacy.sections.socialMatchData.title,
  },
  {
    path: "/human",
    heading: () => "Play Online",
    visibleText: (messages: AppMessages) => messages.human.createRoom.title,
  },
] as const;

test("public localized routes render without missing-message artifacts", async ({ page }) => {
  await mockEmptyHumanLobby(page);

  for (const locale of locales) {
    const messages = messagesByLocale[locale];

    for (const route of publicRouteCases) {
      const verifyNoRuntimeErrors = watchRuntimeTranslationErrors(page);
      await gotoLocalizedRoute(page, locale, route.path);

      await expect(
        page.getByRole("heading", { level: 1, name: route.heading(messages) }),
      ).toBeVisible();
      await expect(
        page.getByText(route.visibleText(messages), { exact: true }).first(),
      ).toBeVisible();
      await expectNoTranslationArtifacts(page, `${locale}${route.path}`);
      verifyNoRuntimeErrors(`${locale}${route.path}`);
    }
  }
});

test("protected social routes redirect to localized login while signed out", async ({ page }) => {
  for (const locale of locales) {
    const messages = messagesByLocale[locale];

    for (const route of ["/friends", "/messages"]) {
      const verifyNoRuntimeErrors = watchRuntimeTranslationErrors(page);
      await gotoLocalizedRoute(page, locale, route);

      await expect(page).toHaveURL(new RegExp(`/${locale}/login$`));
      await expect(
        page.getByRole("heading", { level: 1, name: messages.auth.login.page.hero.title }),
      ).toBeVisible();
      await expect(
        page.getByText(messages.auth.login.title, { exact: true }).first(),
      ).toBeVisible();
      await expectNoTranslationArtifacts(page, `${locale}${route}`);
      verifyNoRuntimeErrors(`${locale}${route}`);
    }
  }
});

test("localized human match room renders active match state", async ({ page }) => {
  await mockEmptyHumanLobby(page);
  await mockHumanMatchState(page);
  await seedStoredHumanMatchSession(page);

  for (const locale of locales) {
    const messages = messagesByLocale[locale];
    const verifyNoRuntimeErrors = watchRuntimeTranslationErrors(page);

    await gotoLocalizedRoute(page, locale, "/human");

    await expect(page.getByTestId("human-match-room")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: messages.human.match.page.title.live }),
    ).toBeVisible();
    await expect(
      page.getByRole("grid", { name: messages.human.match.board.ariaLabel }),
    ).toBeVisible();
    await expect(page.getByText(messages.human.match.statusLine.yourMove)).toBeVisible();
    await expectNoTranslationArtifacts(page, `${locale}/human active match`);
    verifyNoRuntimeErrors(`${locale}/human active match`);
  }
});

async function gotoLocalizedRoute(page: Page, locale: Locale, path: string) {
  await page.goto(`/${locale}${path}`, { waitUntil: "domcontentloaded" });
}

function watchRuntimeTranslationErrors(page: Page) {
  const errors: string[] = [];

  const onPageError = (error: Error) => {
    errors.push(error.message);
  };
  const onConsole = (message: ConsoleMessage) => {
    const text = message.text();

    if (
      (message.type() === "error" || message.type() === "warning") &&
      translationFailurePattern.test(text)
    ) {
      errors.push(text);
    }
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  return (context: string) => {
    page.off("pageerror", onPageError);
    page.off("console", onConsole);
    expect(errors, `${context} should not emit translation/runtime errors`).toEqual([]);
  };
}

async function expectNoTranslationArtifacts(page: Page, context: string) {
  const content = await page.content();

  expect(content, `${context} should not render translation error markers`).not.toMatch(
    translationFailurePattern,
  );
}

async function mockEmptyHumanLobby(page: Page) {
  await page.route(
    (url) => url.pathname === "/api/matches",
    async (route) => {
      await route.fulfill({
        body: JSON.stringify([]),
        contentType: "application/json",
        status: 200,
      });
    },
  );
}

async function mockHumanMatchState(page: Page) {
  await page.route(
    (url) => url.pathname === `/api/matches/${activeMatchId}/state`,
    async (route) => {
      await route.fulfill({
        body: JSON.stringify(matchStateResponse()),
        contentType: "application/json",
        status: 200,
      });
    },
  );
}

async function seedStoredHumanMatchSession(page: Page) {
  await page.addInitScript(
    ({ activeKey, matchId, participantId }) => {
      const session = {
        displayName: "Localized Player",
        matchId,
        mode: "human",
        participantId,
        role: "PLAYER",
        seat: "BLACK",
        updatedAt: new Date().toISOString(),
      };

      window.sessionStorage.setItem(activeKey, matchId);
      window.sessionStorage.setItem(`match:session:v1:${matchId}`, JSON.stringify(session));
    },
    {
      activeKey: activeSessionKey,
      matchId: activeMatchId,
      participantId: activeParticipantId,
    },
  );
}

function matchStateResponse() {
  const board = Array.from({ length: 15 }, () =>
    Array.from({ length: 15 }, () => ({ occupied: false })),
  );

  return {
    board,
    boardSize: 15,
    endReason: null,
    matchId: activeMatchId,
    moves: [],
    nextTurnSeat: "BLACK",
    participants: [
      {
        displayName: "Localized Player",
        joinedAt: "2026-05-17T00:00:00.000Z",
        leftAt: null,
        participantId: activeParticipantId,
        role: "PLAYER",
        seat: "BLACK",
      },
      {
        displayName: "Localized Opponent",
        joinedAt: "2026-05-17T00:00:01.000Z",
        leftAt: null,
        participantId: "localized-opponent",
        role: "PLAYER",
        seat: "WHITE",
      },
    ],
    stateVersion: 3,
    status: "IN_PROGRESS",
    visibility: "PUBLIC",
    winningSeat: null,
  };
}
