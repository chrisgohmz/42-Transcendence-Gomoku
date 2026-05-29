import { expect, type Locator, type Page, test } from "./fixtures";

test.setTimeout(60_000);

test("password reset pages expose usable validation and token wiring", async ({ page }) => {
  await gotoAppRoute(page, "/forgot-password");

  await expect(
    page.getByRole("heading", { level: 1, name: "Find your way back in." }),
  ).toBeVisible();
  const requestForm = await expectVisibleFormWithSubmit(page, "Send reset link");
  const emailInput = requestForm.locator('input[name="email"]');
  await expect(emailInput).toBeVisible();
  await expect(emailInput).toHaveAccessibleName("Email");
  await expect(requestForm.getByRole("button", { name: "Send reset link" })).toBeVisible();
  await expect(requestForm.getByRole("link", { name: "Back to sign in" })).toBeVisible();

  await emailInput.fill("not-an-email");
  await requestForm.getByRole("button", { name: "Send reset link" }).click();
  await expectEmailInputValidity(emailInput, false);

  const resetToken = "fake-reset-token";

  await gotoAppRoute(page, `/reset-password?token=${resetToken}`);

  const appMain = page.locator("#app-main");
  await expect(page.getByRole("heading", { level: 1, name: "Set a fresh key." })).toBeVisible();
  const resetForm = await expectVisibleFormWithSubmit(page, "Reset password");
  const newPasswordInput = resetForm.locator('input[name="newPassword"]');
  const confirmPasswordInput = resetForm.locator('input[name="confirmPassword"]');
  const tokenInput = resetForm.locator('input[type="hidden"][name="token"]');

  await expect(newPasswordInput).toBeVisible();
  await expect(newPasswordInput).toHaveAccessibleName("New password");
  await expect(confirmPasswordInput).toBeVisible();
  await expect(confirmPasswordInput).toHaveAccessibleName("Confirm new password");
  await expect(tokenInput).toHaveValue(resetToken);
  await expectTokenInputIsSubmittedWithResetForm(tokenInput);

  await newPasswordInput.fill("password999");
  await confirmPasswordInput.fill("password000");
  const resetSubmission = page.waitForRequest(
    (request) =>
      request.method() === "POST" && new URL(request.url()).pathname === "/en/reset-password",
  );
  await resetForm.getByRole("button", { name: "Reset password" }).click();
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

async function expectVisibleFormWithSubmit(page: Page, buttonName: string) {
  const form = page
    .locator("form")
    .filter({ has: page.getByRole("button", { name: buttonName }) })
    .filter({ visible: true });

  await expect(form).toHaveCount(1);

  return form;
}

async function expectEmailInputValidity(emailInput: Locator, expected: boolean) {
  const isValid = await emailInput.evaluate((element) =>
    (element as HTMLInputElement).checkValidity(),
  );

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
