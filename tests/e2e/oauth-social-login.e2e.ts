import { randomUUID } from "node:crypto";

import { createId } from "@paralleldrive/cuid2";
import { hashPassword } from "better-auth/crypto";

import { prisma } from "../../app/lib/prisma";
import { expect, type Locator, type Page, type TestInfo, test } from "./fixtures";

test.setTimeout(90_000);

test("configured OAuth providers render branded buttons on auth pages", async ({ page }) => {
  for (const route of ["/login", "/signup"]) {
    await gotoAppRoute(page, route);

    for (const provider of ["Google", "GitHub"]) {
      const button = page.getByRole("button", { name: `Sign in with ${provider}` });

      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
      await expectCenteredButtonContent(button);
    }
  }
});

test("account connections show connect, connected, and disconnect OAuth states", async ({
  page,
}, testInfo) => {
  const user = await createAndSignInTestUser(page, testInfo);

  try {
    await gotoAppRoute(page, "/account");

    const githubConnect = page.getByRole("button", { name: "Connect GitHub" });
    const googleConnect = page.getByRole("button", { name: "Connect Google" });

    await expect(githubConnect).toBeEnabled();
    await expect(googleConnect).toBeEnabled();
    await expect(page.getByRole("button", { name: "Disconnect" })).toHaveCount(0);

    await prisma.account.create({
      data: {
        accountId: `mock-google-${user.token}`,
        id: createId(),
        providerId: "google",
        userId: user.id,
      },
    });

    await gotoAppRoute(page, "/account");

    const googleConnected = page.getByRole("button", { name: "Google connected" });

    await expect(githubConnect).toBeEnabled();
    await expect(page.getByRole("button", { name: "Connect Google" })).toHaveCount(0);
    await expect(googleConnected).toBeDisabled();
    await expectCenteredButtonContent(googleConnected);

    const disconnect = page.getByRole("button", { name: "Disconnect" });

    await expect(disconnect).toHaveCount(1);
    await expect(disconnect).toBeEnabled();
    await expectNoDocumentOverflow(page, "/account");
  } finally {
    await cleanupTestUsers([user.username]);
  }
});

async function gotoAppRoute(page: Page, route: string) {
  await page.goto(`/en${route}`, { waitUntil: "domcontentloaded" });
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

async function expectCenteredButtonContent(button: Locator) {
  const metrics = await button.evaluate((element) => {
    const buttonRect = element.getBoundingClientRect();
    const row = element.firstElementChild;

    if (!row) {
      throw new Error("OAuth button row is missing.");
    }

    const childRects = Array.from(row.children).map((child) => child.getBoundingClientRect());
    const groupLeft = Math.min(...childRects.map((rect) => rect.left));
    const groupRight = Math.max(...childRects.map((rect) => rect.right));

    return {
      centerDelta: Math.abs(
        (groupLeft + groupRight) / 2 - (buttonRect.left + buttonRect.width / 2),
      ),
      height: buttonRect.height,
      width: buttonRect.width,
    };
  });

  expect(metrics.width, "OAuth button should be wide enough to scan").toBeGreaterThanOrEqual(200);
  expect(metrics.height, "OAuth button should keep a touch-friendly height").toBeGreaterThanOrEqual(
    40,
  );
  expect(
    metrics.centerDelta,
    "OAuth button icon/text group should be centered",
  ).toBeLessThanOrEqual(2.5);
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
  const username = `oauth_${token}`;
  const email = `oauth.${token}@example.com`;
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
      displayName: `OAuth Test ${token.slice(-4)}`,
      email,
      emailVerified: true,
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

async function cleanupTestUsers(usernames: string[]) {
  await prisma.user.deleteMany({
    where: {
      username: {
        in: usernames,
      },
    },
  });
}
