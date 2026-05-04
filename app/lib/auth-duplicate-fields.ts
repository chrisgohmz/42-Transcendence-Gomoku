import "server-only";
import type { AuthField } from "./validation/auth-profile";

export type DuplicateSignupFields = Partial<Record<"email" | "username", true>>;

type DuplicateSignupMessageKey = "duplicateAccount" | "duplicateEmail" | "duplicateUsername";

export function hasDuplicateSignupFields(fields: DuplicateSignupFields): boolean {
  return Boolean(fields.email || fields.username);
}

export function getDuplicateSignupFieldErrors(
  duplicateFields: DuplicateSignupFields,
  t: (key: DuplicateSignupMessageKey) => string,
): Partial<Record<AuthField, string[]>> {
  const fields: Partial<Record<AuthField, string[]>> = {};

  if (duplicateFields.email) {
    fields.email = [t("duplicateEmail")];
  }

  if (duplicateFields.username) {
    fields.username = [t("duplicateUsername")];
  }

  return Object.keys(fields).length > 0
    ? fields
    : {
        email: [t("duplicateAccount")],
        username: [t("duplicateAccount")],
      };
}
