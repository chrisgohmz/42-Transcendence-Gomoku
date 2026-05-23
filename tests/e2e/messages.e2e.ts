import { randomUUID } from "node:crypto";

import { createId } from "@paralleldrive/cuid2";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";

import { prisma } from "../../app/lib/prisma";

test.setTimeout(90_000);

test("friend message flow: opens friend-specific composer and sends a message", async ({
  page,
}, testInfo) => {
  const user = await createAndSignInTestUser(page, testInfo);
  const friend = await createAcceptedFriend(user.id, user.token);

  try {
    await page.goto("/friends", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: "Friends" })).toBeVisible();

    // Click the friend-specific Message action and assert the deep link lands
    // with a composer labelled by the friend's name (not a generic placeholder).
    const messageBtn = page
      .getByRole("link", { name: new RegExp(`Message ${friend.displayName}`, "i") })
      .filter({ visible: true })
      .first();
    await messageBtn.click();
    await page.waitForURL(/\/messages/);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
    const composer = page.getByRole("textbox", {
      name: new RegExp(`Message ${friend.displayName}`, "i"),
    });
    await expect(composer).toBeVisible();
    await expect(composer).toBeEnabled();
    const thread = page.getByRole("log", {
      name: new RegExp(`Conversation with ${friend.displayName}`, "i"),
    });
    await expect(thread).toBeVisible();

    // Send a short message and confirm it lands in the thread. We rely on the
    // POST response (not the socket echo) so the assertion does not need to
    // wait on the realtime publisher.
    const sample = `hello ${randomUUID().slice(0, 8)}`;
    await composer.fill(sample);
    await page.getByRole("button", { exact: true, name: "Send" }).click();

    await expect(thread.getByText(sample, { exact: true })).toBeVisible();
  } finally {
    await cleanupTestUsers([user.username, friend.username]);
  }
});

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
    await page.goto("/login", { waitUntil: "domcontentloaded" });
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
