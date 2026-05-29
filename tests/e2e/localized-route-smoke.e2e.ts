import { localeCookieName, locales, type Locale } from "../../app/i18n/config";
import { messages as enMessages } from "../../app/i18n/messages/en";
import { messages as jaMessages } from "../../app/i18n/messages/ja";
import { messages as zhMessages } from "../../app/i18n/messages/zh";
import {
  allowPageError,
  allowResponseStatus,
  expect,
  type ConsoleMessage,
  type Page,
  test,
  type TestInfo,
} from "./fixtures";

type AppMessages = typeof enMessages;

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);
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
const activeAiMatchId = "localized-ai-match";
const activeAiParticipantId = "localized-ai-player";
const translationFailurePattern =
  /MISSING_MESSAGE|IntlError|Missing message|Could not resolve|Failed to format message/i;

const publicRouteCases = [
  {
    path: "/home",
    heading: (messages: AppMessages) => messages.home.dashboard.hero.title,
    visibleText: (messages: AppMessages) => messages.home.dashboard.cards.ai.title,
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
    heading: (messages: AppMessages) => messages.human.page.lobby.title,
    visibleText: (messages: AppMessages) => messages.human.createRoom.title,
  },
  {
    path: "/ai",
    heading: (messages: AppMessages) => messages.aiLobby.hero.title,
    visibleText: (messages: AppMessages) => messages.aiLobby.preview.openingPreview,
  },
] as const;

for (const locale of locales) {
  test(`public ${locale} routes render without missing-message artifacts`, async ({ page }) => {
    await mockEmptyHumanLobby(page);
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
  });
}

test("global 404 uses the cookie-selected locale for unmatched routes", async ({
  page,
}, testInfo) => {
  const locale: Locale = "ja";
  const messages = messagesByLocale[locale];
  const verifyNoRuntimeErrors = watchRuntimeTranslationErrors(page);
  const localizedMissingRoute = `/${locale}/missing-global-404-route`;

  allowPageError(testInfo, { browserName: "firefox", message: "Error in input stream" });
  allowResponseStatus(testInfo, {
    status: 404,
    url: new URL(localizedMissingRoute, getTestBaseURL(testInfo)).toString(),
  });
  await page.context().addCookies([
    {
      name: localeCookieName,
      url: getTestBaseURL(testInfo),
      value: locale,
    },
  ]);

  const response = await page.goto("/missing-global-404-route", {
    waitUntil: "domcontentloaded",
  });

  expect(response?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect(
    page.getByRole("heading", { level: 1, name: messages.notFound.title }),
  ).toBeVisible();
  await expect(page.getByText(messages.notFound.description, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: messages.notFound.returnHome })).toHaveAttribute(
    "href",
    `/${locale}`,
  );
  await expectNoTranslationArtifacts(page, "global 404");
  verifyNoRuntimeErrors("global 404");
});

for (const locale of locales) {
  test(`localized ${locale} AI route starts an active match`, async ({ page }) => {
    await mockAiMatchFlow(page);
    const messages = messagesByLocale[locale];
    const verifyNoRuntimeErrors = watchRuntimeTranslationErrors(page);

    await gotoLocalizedRoute(page, locale, "/ai");

    await expect(
      page.getByRole("heading", { level: 1, name: messages.aiLobby.hero.title }),
    ).toBeVisible();
    await expect(
      page.getByText(messages.aiLobby.preview.openingPreview, { exact: true }),
    ).toBeVisible();
    await expectNoTranslationArtifacts(page, `${locale}/ai lobby`);

    const startTrainingButton = page.getByRole("button", {
      name: messages.aiLobby.setup.startButton,
    });
    await expect(startTrainingButton).toBeEnabled({ timeout: 30_000 });
    await startTrainingButton.click();

    await expect(page.getByTestId("ai-match-room")).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: messages.aiLobby.matchRoom.page.title.live,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("grid", { name: messages.aiLobby.matchRoom.board.ariaLabel }),
    ).toBeVisible();
    await expectNoTranslationArtifacts(page, `${locale}/ai active match`);
    verifyNoRuntimeErrors(`${locale}/ai active match`);
  });
}

test("protected social routes redirect to localized login while signed out", async ({ page }) => {
  for (const locale of locales) {
    const messages = messagesByLocale[locale];

    for (const route of ["/friends", "/messages", "/status"]) {
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

  for (const locale of locales) {
    const messages = messagesByLocale[locale];
    const verifyNoRuntimeErrors = watchRuntimeTranslationErrors(page);

    await seedStoredHumanMatchSession(page, locale);
    await gotoLocalizedRoute(page, locale, "/human");

    await expect(page.getByTestId("human-match-room")).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("heading", { level: 1, name: messages.human.match.page.title.live }),
    ).toBeVisible();
    await expect(
      page.getByRole("grid", { name: messages.human.match.board.ariaLabel }),
    ).toBeVisible();
    await expect(page.getByText(messages.human.match.seat.black, { exact: true })).toBeVisible();
    await expect(page.getByText(messages.human.match.seat.white, { exact: true })).toBeVisible();
    await expect(page.getByText("Localized Player", { exact: true })).toBeVisible();
    await expect(page.getByText("Localized Opponent", { exact: true })).toBeVisible();
    await expect(page.getByText(messages.human.match.timer.label, { exact: true })).toBeVisible();
    await expectNoTranslationArtifacts(page, `${locale}/human active match`);
    verifyNoRuntimeErrors(`${locale}/human active match`);
  }
});

async function gotoLocalizedRoute(page: Page, locale: Locale, path: string) {
  await page.goto(`/${locale}${path}`, { waitUntil: "domcontentloaded" });
}

function getTestBaseURL(testInfo: TestInfo) {
  const baseURL = testInfo.project.use.baseURL;

  return typeof baseURL === "string" ? baseURL : "http://localhost:3000";
}

function watchRuntimeTranslationErrors(page: Page) {
  const errors: string[] = [];

  const onPageError = (error: Error) => {
    const text = error.stack ?? error.message;

    if (translationFailurePattern.test(text)) {
      errors.push(text);
    }
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
        body: JSON.stringify(lobbyMatchesResponse([])),
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

async function mockAiMatchFlow(page: Page) {
  await page.route(
    (url) => url.pathname === "/api/matches/solo",
    async (route) => {
      expect(route.request().postDataJSON()).toMatchObject({
        difficulty: "expert",
        playerSeat: "BLACK",
      });
      await route.fulfill({
        body: JSON.stringify({
          difficulty: "expert",
          matchId: activeAiMatchId,
          participantId: activeAiParticipantId,
          role: "PLAYER",
          seat: "BLACK",
        }),
        contentType: "application/json",
        status: 200,
      });
    },
  );
  await page.route(
    (url) => url.pathname === `/api/matches/${activeAiMatchId}/state`,
    async (route) => {
      await route.fulfill({
        body: JSON.stringify(aiMatchStateResponse()),
        contentType: "application/json",
        status: 200,
      });
    },
  );
}

async function seedStoredHumanMatchSession(page: Page, locale: Locale) {
  await gotoLocalizedRoute(page, locale, "/home");
  await page.evaluate(
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

function lobbyMatchesResponse(data: unknown[]) {
  return {
    data,
    limit: 10,
    page: 1,
    totalMatches: data.length,
    totalPages: Math.max(1, Math.ceil(data.length / 10)),
  };
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

function aiMatchStateResponse() {
  const board = Array.from({ length: 15 }, () =>
    Array.from({ length: 15 }, () => ({ occupied: false })),
  );

  return {
    aiDifficulty: "expert",
    board,
    boardSize: 15,
    endReason: null,
    matchId: activeAiMatchId,
    mode: "ai",
    moves: [],
    nextTurnSeat: "BLACK",
    participants: [
      {
        displayName: "Localized Player",
        joinedAt: "2026-05-17T00:00:00.000Z",
        leftAt: null,
        participantId: activeAiParticipantId,
        role: "PLAYER",
        seat: "BLACK",
      },
      {
        displayName: "Kata Reader",
        joinedAt: "2026-05-17T00:00:01.000Z",
        leftAt: null,
        participantId: "localized-ai-opponent",
        role: "PLAYER",
        seat: "WHITE",
      },
    ],
    stateVersion: 1,
    status: "IN_PROGRESS",
    visibility: "PRIVATE",
    winningSeat: null,
  };
}
