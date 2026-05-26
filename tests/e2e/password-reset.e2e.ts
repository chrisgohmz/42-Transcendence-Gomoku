import { expect, type Locator, type Page, test } from "./fixtures";

test.setTimeout(60_000);

test("password reset pages expose usable validation and token wiring", async ({ page }) => {
  await gotoAppRoute(page, "/forgot-password");

  await expect(
    page.getByRole("heading", { level: 1, name: "Find your way back in." }),
  ).toBeVisible();
  const emailInput = page.getByLabel("Email");
  await expect(emailInput).toBeVisible();
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to sign in" })).toBeVisible();

  await emailInput.fill("not-an-email");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(emailInput).toBeFocused();
  await expectEmailInputValidity(page, false);

  const resetToken = "fake-reset-token";

  await gotoAppRoute(page, `/reset-password?token=${resetToken}`);

  const appMain = page.locator("#app-main");
  await expect(page.getByRole("heading", { level: 1, name: "Set a fresh key." })).toBeVisible();
  const newPasswordInput = page.getByLabel("New password", { exact: true });
  const confirmPasswordInput = page.getByLabel("Confirm new password");
  const tokenInput = appMain.locator('input[type="hidden"][name="token"]');

  await expect(newPasswordInput).toBeVisible();
  await expect(confirmPasswordInput).toBeVisible();
  await expect(tokenInput).toHaveValue(resetToken);
  await expectTokenInputIsSubmittedWithResetForm(tokenInput);

  await newPasswordInput.fill("password999");
  await confirmPasswordInput.fill("password000");
  const resetSubmission = page.waitForRequest(
    (request) =>
      request.method() === "POST" && new URL(request.url()).pathname === "/en/reset-password",
  );
  await page.getByRole("button", { name: "Reset password" }).click();
  const submittedRequest = await resetSubmission;

  await expect(page.getByText("New passwords do not match.")).toBeVisible();
  await expect(page.getByText("Please fix the highlighted fields.")).toBeVisible();
  expect(new URL(submittedRequest.url()).searchParams.get("token")).toBe(resetToken);

  await gotoAppRoute(page, "/reset-password");

  await expect(
    appMain.getByRole("heading", { level: 2, name: "Reset link unavailable." }),
  ).toBeVisible();
  await expect(
    appMain
      .getByText("This password reset link is missing, invalid, or expired.", { exact: true })
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await expect(appMain.getByRole("link", { name: "Request a new link" })).toHaveAttribute(
    "href",
    "/en/forgot-password",
  );
});

async function gotoAppRoute(page: Page, route: string) {
  await page.goto(`/en${route}`, { waitUntil: "domcontentloaded" });
}

async function expectEmailInputValidity(page: Page, expected: boolean) {
  const isValid = await page
    .getByLabel("Email")
    .evaluate((element) => (element as HTMLInputElement).checkValidity());

  expect(isValid).toBe(expected);
}

async function expectTokenInputIsSubmittedWithResetForm(tokenInput: Locator) {
  const belongsToResetForm = await tokenInput.evaluate((element) => {
    const input = element as HTMLInputElement;
    const form = input.form;

    return input.name === "token" && input.type === "hidden" && Boolean(form?.contains(input));
  });

  expect(belongsToResetForm, "reset token input should be a submitted form control").toBe(true);
}
