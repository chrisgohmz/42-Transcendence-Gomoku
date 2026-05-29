import { randomUUID } from "node:crypto";

import { createId } from "@paralleldrive/cuid2";
import { hashPassword } from "better-auth/crypto";

import { prisma } from "../../app/lib/prisma";
import { expect, type Page, type TestInfo, test } from "./fixtures";

test.setTimeout(90_000);

test("OAuth-only profile settings show linked email and set password without current password", async ({
  page,
}, testInfo) => {
  const user = await createAndSignInTestUser(page, testInfo);

  try {
    await convertSignedInUserToOAuthOnly(user);

    await gotoAppRoute(page, "/profile");

    await expect(visibleExactText(page, "Linked email:")).toBeVisible();
    await expect(visibleExactText(page, user.email)).toBeVisible();

    await gotoAppRoute(page, "/profile/edit");

    await expect(visibleExactText(page, "Linked Email (Not editable)")).toBeVisible();
    await expect(visibleExactText(page, user.email)).toBeVisible();

    await visibleButton(page, "Edit").click();
    await expect(visibleLabel(page, "Linked Email (Not editable)")).toHaveValue(user.email);
    await visibleButton(page, "Cancel").click();

    await expect(visibleExactText(page, "No password set")).toBeVisible();
    await visibleButton(page, "Set").click();

    await expect(page.getByLabel("Current Password").filter({ visible: true })).toHaveCount(0);
    await visibleLabel(page, "New Password", { exact: true }).fill("password999");
    await visibleLabel(page, "Confirm New Password", { exact: true }).fill("password999");
    await visibleButton(page, "Set Password").click();

    await expect.poll(() => hasCredentialAccount(user.id), { timeout: 75_000 }).toBe(true);

    await gotoAppRoute(page, "/profile/edit");
    await expect(visibleButton(page, "Change", { exact: true })).toBeVisible();
  } finally {
    await cleanupTestUsers([user.username]);
  }
});

async function gotoAppRoute(page: Page, route: string) {
  await page.goto(`/en${route}`, { waitUntil: "domcontentloaded" });
}

function visibleExactText(page: Page, text: string) {
  return page.getByText(text, { exact: true }).filter({ visible: true }).first();
}

function visibleLabel(page: Page, text: string, options?: { exact?: boolean }) {
  return page.getByLabel(text, options).filter({ visible: true }).first();
}

function visibleButton(page: Page, name: string, options?: { exact?: boolean }) {
  return page
    .getByRole("button", { name, ...options })
    .filter({ visible: true })
    .first();
}

type TestUser = {
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
  const username = `profile_auth_${token}`;
  const email = `profile.auth.${token}@example.com`;
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
      displayName: `Profile Auth ${token.slice(-4)}`,
      email,
      emailVerified: true,
      id: userId,
      username,
    },
    select: { id: true },
  });

  try {
    await gotoAppRoute(page, "/login");
    await visibleLabel(page, "Email").fill(email);
    await visibleLabel(page, "Password").fill("password123");
    await visibleButton(page, "Sign in", { exact: true }).click();
    await expect(page).toHaveURL(/\/en\/profile$/);
  } catch (error) {
    await cleanupTestUsers([username]);
    throw error;
  }

  return {
    email,
    id: dbUser.id,
    token,
    username,
  };
}

async function convertSignedInUserToOAuthOnly(user: TestUser) {
  await prisma.account.deleteMany({
    where: {
      providerId: "credential",
      userId: user.id,
    },
  });
  await prisma.account.create({
    data: {
      accountId: `mock-google-${user.token}`,
      id: createId(),
      providerId: "google",
      userId: user.id,
    },
  });
}

async function hasCredentialAccount(userId: string) {
  const credentialAccount = await prisma.account.findFirst({
    where: {
      password: { not: null },
      providerId: "credential",
      userId,
    },
    select: { id: true },
  });

  return Boolean(credentialAccount);
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
