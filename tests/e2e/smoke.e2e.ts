import { randomUUID } from "node:crypto";

import { createId } from "@paralleldrive/cuid2";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";

import { prisma } from "../../app/lib/prisma";

const routes = ["/", "/game", "/human", "/leaderboard", "/login", "/signup"] as const;

test.setTimeout(90_000);

test("home page renders the redesigned command center", async ({ page }) => {
  await gotoAppRoute(page, "/");

  await expect(page).toHaveTitle(/Transcendence/);
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("heading", { level: 1, name: "Master the board." })).toBeVisible();
  await expect(page.getByText("Ranked Snapshot", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Train vs AI" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Challenge Human" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /vs AI/i }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("Active Game", { exact: true })).toHaveCount(0);
  await expect(page.getByText("vs Human Lobby", { exact: true })).toHaveCount(0);
});

test("primary game routes render their new page shells", async ({ page }) => {
  await gotoAppRoute(page, "/game");
  await expect(
    page.getByRole("heading", { level: 1, name: "Choose your opponent." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kata Reader" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start Training" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  await gotoAppRoute(page, "/human");
  await expect(page.getByRole("heading", { level: 1, name: "Play Online" })).toBeVisible();
  await expect(page.getByTestId("game-lobby-table")).toBeVisible();

  await gotoAppRoute(page, "/leaderboard");
  await expect(page.getByRole("heading", { level: 1, name: "Leaderboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top 100" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rank Bands" })).toBeVisible();
});

test("auth pages expose usable sign-in and sign-up forms", async ({ page }) => {
  await gotoAppRoute(page, "/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { exact: true, name: "Sign in" })).toBeVisible();

  await gotoAppRoute(page, "/signup");
  await expect(page.getByRole("heading", { name: "Create your account." })).toBeVisible();
  await expect(page.getByLabel("Username")).toBeVisible();
  await expect(page.getByLabel("Display name")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});

test("localized shell avoids horizontal overflow on public routes", async ({ page }) => {
  for (const route of routes) {
    await gotoAppRoute(page, route);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(dimensions.scrollWidth, `${route} should not horizontally overflow`).toBeLessThanOrEqual(
      dimensions.clientWidth + 1,
    );
  }
});

test("selector and popup surfaces stay opaque and readable", async ({ page }) => {
  await gotoAppRoute(page, "/");

  const localeSelect = page
    .locator("button:has(svg.lucide-globe)")
    .filter({ visible: true })
    .first();
  await expect(localeSelect).toBeVisible();

  const localeStyles = await localeSelect.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      color: styles.color,
    };
  });

  expect(localeStyles.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(localeStyles.color).toBe("rgb(174, 184, 174)");

  const popupStyles = await page.evaluate(() => {
    const element = document.createElement("div");
    element.setAttribute("data-slot", "dropdown-menu-content");
    document.body.append(element);
    const styles = getComputedStyle(element);
    const snapshot = {
      backdropFilter: styles.backdropFilter,
      backgroundColor: styles.backgroundColor,
      color: styles.color,
      opacity: styles.opacity,
    };
    element.remove();
    return snapshot;
  });

  expect(popupStyles.backgroundColor).toBe("rgb(8, 17, 14)");
  expect(popupStyles.color).toBe("rgb(246, 241, 231)");
  expect(popupStyles.opacity).toBe("1");
  expect(popupStyles.backdropFilter).toBe("none");
});

test("authenticated redesigned pages render at desktop and mobile widths", async ({
  page,
}, testInfo) => {
  const user = await createAndSignInTestUser(page, testInfo);
  const friend = await createAcceptedFriend(user.id, user.token);

  try {
    await gotoAppRoute(page, "/account");
    await expect(page.getByRole("heading", { level: 1, name: "Account Settings" })).toBeVisible();
    await expect(
      page.getByText(user.email, { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expectNoDocumentOverflow(page, "/account");

    await gotoAppRoute(page, "/profile");
    await expect(page.getByRole("heading", { level: 1, name: user.displayName })).toBeVisible();
    await expect(page.getByRole("link", { name: /Edit Profile/i })).toBeVisible();
    await expectNoDocumentOverflow(page, "/profile");

    await gotoAppRoute(page, "/profile/edit");
    await expect(page.getByRole("heading", { level: 1, name: "Edit Profile" })).toBeVisible();
    await expectNoDocumentOverflow(page, "/profile/edit");

    await gotoAppRoute(page, "/friends");
    await expect(page.getByRole("heading", { level: 1, name: "Friends" })).toBeVisible();
    await expect(
      page.getByText(friend.displayName, { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await expect(page.getByTestId("friends-table").filter({ visible: true })).toBeVisible();
    await expectNoDocumentOverflow(page, "/friends");

    // Shallow check that /messages renders for an authenticated user.
    // The friend-to-message workflow has its own scenario in messages.e2e.ts.
    await gotoAppRoute(page, "/messages");
    await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
    await expectNoDocumentOverflow(page, "/messages");
  } finally {
    await cleanupTestUsers([user.username, friend.username]);
  }
});

async function gotoAppRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
}

async function expectNoDocumentOverflow(page: Page, route: string) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(dimensions.scrollWidth, `${route} should not horizontally overflow`).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
}

type TestUser = {
  displayName: string;
  email: string;
  id: string;
  token: string;
  username: string;
};

async function createAndSignInTestUser(page: Page, testInfo: TestInfo): Promise<TestUser> {
  const project = testInfo.project.name
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase()
    .slice(0, 6);
  const token = `${project}${testInfo.workerIndex}${randomUUID().slice(0, 8)}`;
  const username = `e2e_${token}`;
  const email = `gomoku.${token}@example.com`;
  const displayName = `E2E Player ${token.slice(-4)}`;
  const userId = createId();
  const hashedPassword = await hashPassword("password123");

  const dbUser = await prisma.user.create({
    data: {
      id: userId,
      accounts: {
        create: {
          id: createId(),
          accountId: userId,
          password: hashedPassword,
          providerId: "credential",
        },
      },
      displayName,
      email,
      emailVerified: true,
      username,
    },
    select: { id: true },
  });

  try {
    await gotoAppRoute(page, "/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { exact: true, name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/en\/profile$/);
  } catch (error) {
    await cleanupTestUsers([username]);
    throw error;
  }

  return {
    displayName,
    email,
    id: dbUser.id,
    token,
    username,
  };
}

async function createAcceptedFriend(userId: string, token: string) {
  const username = `e2e_friend_${token}`;
  const friend = await prisma.user.create({
    data: {
      displayName: `Rival ${token.slice(-4)}`,
      email: `gomoku.friend.${token}@example.com`,
      emailVerified: true,
      username,
    },
  });
  const friendshipIds =
    userId < friend.id
      ? { userLowId: userId, userHighId: friend.id }
      : { userLowId: friend.id, userHighId: userId };

  await prisma.userGameStats.create({
    data: {
      boardSize: 15,
      losses: 4,
      matchesPlayed: 12,
      rating: 1710,
      ruleType: "GOMOKU",
      userId: friend.id,
      wins: 8,
    },
  });
  await prisma.friendship.create({
    data: {
      acceptedAt: new Date(),
      requestedById: userId,
      respondedAt: new Date(),
      status: "ACCEPTED",
      userHighId: friendshipIds.userHighId,
      userLowId: friendshipIds.userLowId,
    },
  });

  return {
    displayName: friend.displayName,
    username,
  };
}

async function cleanupTestUsers(usernames: string[]) {
  await prisma.user.deleteMany({
    where: {
      username: {
        in: usernames,
      },
    },
  });
}
