import { expect, test } from "@playwright/test";

test("home page renders the localized shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Transcendence/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "One command boots the full local stack.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();
});
