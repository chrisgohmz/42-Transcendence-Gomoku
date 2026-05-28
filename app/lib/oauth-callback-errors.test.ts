import { describe, expect, test } from "bun:test";

import { getOAuthCallbackErrorKey } from "./oauth-callback-errors";

describe("getOAuthCallbackErrorKey", () => {
  test("ignores missing or empty callback error values", () => {
    expect(getOAuthCallbackErrorKey(undefined)).toBeNull();
    expect(getOAuthCallbackErrorKey("")).toBeNull();
    expect(getOAuthCallbackErrorKey("   ")).toBeNull();
  });

  test("maps Better Auth OAuth linking failures to UI message keys", () => {
    expect(getOAuthCallbackErrorKey("email_doesn't_match")).toBe("emailMismatch");
    expect(getOAuthCallbackErrorKey("account_not_linked")).toBe("accountNotLinked");
    expect(getOAuthCallbackErrorKey("account_already_linked_to_different_user")).toBe(
      "accountAlreadyLinked",
    );
    expect(getOAuthCallbackErrorKey("unable_to_link_account")).toBe("unableToLink");
  });

  test("uses the first query value and falls back to a generic OAuth message", () => {
    expect(getOAuthCallbackErrorKey(["LINKING_DIFFERENT_EMAILS_NOT_ALLOWED"])).toBe(
      "emailMismatch",
    );
    expect(getOAuthCallbackErrorKey(["no_code", "email_doesn't_match"])).toBe("generic");
  });
});
