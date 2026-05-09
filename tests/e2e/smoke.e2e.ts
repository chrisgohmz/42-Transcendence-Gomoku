import { expect, type Page, test } from "@playwright/test";

const routes = ["/", "/game", "/human", "/leaderboard", "/login", "/signup"] as const;

test.setTimeout(60_000);

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
  await expect(page.getByRole("heading", { level: 1, name: "Active game vs AI" })).toBeAttached();
  await expect(page.getByRole("heading", { name: "Kata Reader" })).toBeVisible();
  await expect(page.getByText("Move History", { exact: true }).first()).toBeVisible();

  await gotoAppRoute(page, "/human");
  await expect(page.getByRole("heading", { level: 1, name: /Find a room/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Room List" })).toBeVisible();

  await gotoAppRoute(page, "/leaderboard");
  await expect(page.getByRole("heading", { level: 1, name: "Leaderboard" })).toBeVisible();
  await expect(
    page.getByText("Preview standings are shown until completed matches report results."),
  ).toBeVisible();
  await expect(
    page.getByText("Hoshi", { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rank Bands" })).toBeVisible();
});

test("auth pages expose usable sign-in and sign-up forms", async ({ page }) => {
  await gotoAppRoute(page, "/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

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

  const localeSelect = page.locator(".locale-switcher select").filter({ visible: true }).first();
  await expect(localeSelect).toBeVisible();

  const localeStyles = await localeSelect.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      color: styles.color,
    };
  });

  expect(localeStyles.backgroundColor).toBe("rgb(8, 17, 14)");
  expect(localeStyles.color).toBe("rgb(246, 241, 231)");

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

async function gotoAppRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
}
