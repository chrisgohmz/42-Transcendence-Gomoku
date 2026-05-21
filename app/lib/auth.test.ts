import { describe, expect, test } from "bun:test";

const authSource = await Bun.file(new URL("./auth.ts", import.meta.url)).text();

describe("auth configuration", () => {
  test("requires local email verification before credential sign-in or implicit OAuth linking", () => {
    expect(authSource).toContain("requireEmailVerification: true");
    expect(authSource).toContain("sendOnSignUp: true");
    expect(authSource).toContain("sendOnSignIn: true");
    expect(authSource).toContain("autoSignInAfterVerification: true");
    expect(authSource).toContain("sendEmailVerificationEmail");
    expect(authSource).not.toContain("requireLocalEmailVerified: false");
    expect(authSource).not.toContain('trustedProviders: ["google"]');
  });
});
