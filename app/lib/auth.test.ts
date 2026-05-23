import { describe, expect, test } from "bun:test";

import { authCredentialPolicy } from "./auth-policy";

describe("auth configuration", () => {
  test("requires local email verification before credential sign-in or implicit OAuth linking", () => {
    expect(authCredentialPolicy.emailAndPassword.requireEmailVerification).toBe(true);
    expect(authCredentialPolicy.emailVerification.sendOnSignUp).toBe(true);
    expect(authCredentialPolicy.emailVerification.sendOnSignIn).toBe(true);
    expect(authCredentialPolicy.emailVerification.autoSignInAfterVerification).toBe(true);
    expect(authCredentialPolicy.accountLinking.enabled).toBe(true);
    expect(authCredentialPolicy.accountLinking.requireLocalEmailVerified).toBe(true);
    expect("trustedProviders" in authCredentialPolicy.accountLinking).toBe(false);
  });
});
