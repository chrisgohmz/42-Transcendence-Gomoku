import { randomUUID } from "node:crypto";

import { createId } from "@paralleldrive/cuid2";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";

import { prisma } from "../../app/lib/prisma";
import {
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  RuleType,
  Seat,
} from "../../generated/prisma/enums";

test.setTimeout(90_000);

test("friends roster pagination shows one page of friends at a time", async ({
  page,
}, testInfo) => {
  const user = await createAndSignInTestUser(page, testInfo);
  const friends = await createAcceptedFriends(user.id, user.token, 11);
  const friendNames = friends.map((friend) => friend.displayName);

  try {
    await gotoAppRoute(page, "/friends");

    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    const firstPageNames = await visibleFriendNames(page, friendNames);
    expect(firstPageNames).toHaveLength(10);

    const nextButton = page
      .getByRole("button", { exact: true, name: "Next" })
      .filter({ visible: true });
    const previousButton = page
      .getByRole("button", { exact: true, name: "Previous" })
      .filter({ visible: true });

    await expect(previousButton).toBeDisabled();
    await nextButton.click();

    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    const secondPageNames = await visibleFriendNames(page, friendNames);
    expect(secondPageNames).toHaveLength(1);
    expect(firstPageNames).not.toContain(secondPageNames[0]);
    await expect(nextButton).toBeDisabled();

    await previousButton.click();

    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    expect(await visibleFriendNames(page, friendNames)).toEqual(firstPageNames);
  } finally {
    await cleanupUsers([user.username, ...friends.map((friend) => friend.username)]);
  }
});

test("public profile match history pagination updates the historyPage query", async ({ page }) => {
  const created = await createProfileWithMatchHistory(11);
  const newestOpponent = created.opponents[0];
  const oldestOpponent = created.opponents.at(-1);

  if (!newestOpponent || !oldestOpponent) {
    throw new Error("Expected profile history fixture to create opponents");
  }

  try {
    await gotoAppRoute(page, `/profile/${created.profile.username}`);

    await expect(
      page.getByRole("heading", { level: 1, name: created.profile.displayName }),
    ).toBeVisible();
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
    await expect(page.getByText(newestOpponent.displayName, { exact: true })).toBeVisible();
    await expect(page.getByText(oldestOpponent.displayName, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { exact: true, name: "Next" }).filter({ visible: true }).click();

    await expect(page).toHaveURL(/historyPage=2/);
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await expect(page.getByText(oldestOpponent.displayName, { exact: true })).toBeVisible();
    await expect(page.getByText(newestOpponent.displayName, { exact: true })).toHaveCount(0);

    await page
      .getByRole("button", { exact: true, name: "Previous" })
      .filter({ visible: true })
      .click();

    await expect(page).not.toHaveURL(/historyPage=/);
    await expect(page.getByText("Page 1 of 2")).toBeVisible();
  } finally {
    await cleanupMatches(created.matchIds);
    await cleanupUsers([
      created.profile.username,
      ...created.opponents.map((opponent) => opponent.username),
    ]);
  }
});

async function gotoAppRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
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
  const username = `e2e_page_${token}`;
  const email = `gomoku.page.${token}@example.com`;
  const displayName = `Page Player ${token.slice(-4)}`;
  const userId = createId();
  const hashedPassword = await hashPassword("password123");

  const dbUser = await prisma.user.create({
    data: {
      accounts: {
        create: {
          accountId: userId,
          id: createId(),
          password: hashedPassword,
          providerId: "credential",
        },
      },
      displayName,
      email,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      id: userId,
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
    await cleanupUsers([username]);
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

async function createAcceptedFriends(userId: string, token: string, count: number) {
  const friends: Array<{ displayName: string; username: string }> = [];

  for (let index = 0; index < count; index += 1) {
    const suffix = `${token}_${index.toString().padStart(2, "0")}`;
    const friend = await prisma.user.create({
      data: {
        displayName: `Roster Friend ${index.toString().padStart(2, "0")} ${token.slice(-4)}`,
        email: `gomoku.roster.${suffix}@example.com`,
        emailVerified: true,
        username: `e2e_roster_${suffix}`,
      },
    });
    const friendshipIds = orderedFriendshipIds(userId, friend.id);

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

    friends.push({
      displayName: friend.displayName,
      username: friend.username,
    });
  }

  return friends;
}

async function visibleFriendNames(page: Page, friendNames: string[]) {
  const tableText = await page.getByTestId("friends-table").filter({ visible: true }).innerText();

  return friendNames.filter((name) => tableText.includes(name));
}

async function createProfileWithMatchHistory(count: number) {
  const token = `hist_${randomUUID().slice(0, 8)}`;
  const profile = await prisma.user.create({
    data: {
      displayName: `History Player ${token.slice(-4)}`,
      email: `gomoku.history.${token}@example.com`,
      emailVerified: true,
      username: `e2e_${token}`,
    },
  });
  const opponents: Array<{ displayName: string; username: string }> = [];
  const matchIds: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const suffix = `${token}_${index.toString().padStart(2, "0")}`;
    const opponent = await prisma.user.create({
      data: {
        displayName: `History Rival ${index.toString().padStart(2, "0")} ${token.slice(-4)}`,
        email: `gomoku.history.rival.${suffix}@example.com`,
        emailVerified: true,
        username: `e2e_rival_${suffix}`,
      },
    });
    const matchId = createId();
    const finishedAt = new Date(Date.UTC(2026, 4, 20 - index, 12, 0, 0));

    await prisma.match.create({
      data: {
        boardSize: 15,
        createdAt: new Date(finishedAt.getTime() - 15 * 60_000),
        endReason: "five_in_a_row",
        finishedAt,
        id: matchId,
        participants: {
          create: [
            {
              displayNameSnapshot: profile.displayName,
              result: MatchResult.WIN,
              role: Role.PLAYER,
              seat: Seat.BLACK,
              userId: profile.id,
            },
            {
              displayNameSnapshot: opponent.displayName,
              result: MatchResult.LOSS,
              role: Role.PLAYER,
              seat: Seat.WHITE,
              userId: opponent.id,
            },
          ],
        },
        ruleType: RuleType.GOMOKU,
        startedAt: new Date(finishedAt.getTime() - 10 * 60_000),
        status: MatchStatus.FINISHED,
        visibility: MatchVisibility.PUBLIC,
        winningSeat: Seat.BLACK,
      },
    });

    opponents.push({
      displayName: opponent.displayName,
      username: opponent.username,
    });
    matchIds.push(matchId);
  }

  return { matchIds, opponents, profile };
}

function orderedFriendshipIds(left: string, right: string) {
  return left < right
    ? { userHighId: right, userLowId: left }
    : { userHighId: left, userLowId: right };
}

async function cleanupMatches(matchIds: string[]) {
  await prisma.match.deleteMany({
    where: {
      id: {
        in: matchIds,
      },
    },
  });
}

async function cleanupUsers(usernames: string[]) {
  await prisma.user.deleteMany({
    where: {
      username: {
        in: usernames,
      },
    },
  });
}
