export const authValidationLimits = {
  displayNameMaxLength: 80,
  emailMaxLength: 254,
  passwordMaxLength: 128,
  passwordMinLength: 8,
  usernameMaxLength: 32,
  usernameMinLength: 3,
} as const;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usernamePattern = /^[A-Za-z0-9_-]+$/;

export type AuthField = "displayName" | "email" | "password" | "username";
export type ProfileSettingsField =
  | "confirmPassword"
  | "currentPassword"
  | "displayName"
  | "newPassword";

export type AuthValidationIssueCode =
  | "displayNameTooLong"
  | "emailRequired"
  | "emailTooLong"
  | "invalidEmail"
  | "invalidUsername"
  | "passwordRequired"
  | "passwordTooLong"
  | "shortPassword"
  | "shortUsername"
  | "usernameRequired"
  | "usernameTooLong";

export type ProfileSettingsValidationIssueCode =
  | "confirmPasswordRequired"
  | "currentPasswordRequired"
  | "displayNameRequired"
  | "displayNameTooLong"
  | "newPasswordRequired"
  | "passwordMismatch"
  | "passwordTooLong"
  | "shortPassword";

export type ValidationIssue<Field extends string, Code extends string> = {
  code: Code;
  field: Field;
};

export type ValidationResult<Data, Field extends string, Code extends string> =
  | { data: Data; ok: true }
  | { issues: ValidationIssue<Field, Code>[]; ok: false };

export type LoginInput = {
  email?: unknown;
  password?: unknown;
};

export type SignupInput = LoginInput & {
  displayName?: unknown;
  username?: unknown;
};

export type ProfileSettingsInput = {
  confirmPassword?: unknown;
  currentPassword?: unknown;
  displayName?: unknown;
  newPassword?: unknown;
};

export type ValidLoginInput = {
  email: string;
  password: string;
};

export type ValidSignupInput = ValidLoginInput & {
  displayName: string;
  username: string;
};

export type ValidProfileSettingsInput = {
  currentPassword: string;
  displayName: string;
  newPassword: string;
  wantsToChangePassword: boolean;
};

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string): string {
  return username.trim();
}

function normalizePassword(password: unknown): string {
  return getString(password).trim();
}

function addIssue<Field extends string, Code extends string>(
  issues: ValidationIssue<Field, Code>[],
  field: Field,
  code: Code,
) {
  issues.push({ field, code });
}

export function fieldIssuesToMap<Field extends string, Code extends string, Value>(
  issues: ValidationIssue<Field, Code>[],
  translate: (code: Code) => Value,
): Partial<Record<Field, Value[]>> {
  const fields: Partial<Record<Field, Value[]>> = {};

  for (const issue of issues) {
    const values = fields[issue.field] ?? [];
    values.push(translate(issue.code));
    fields[issue.field] = values;
  }

  return fields;
}

export function validateLoginInput(
  input: LoginInput,
): ValidationResult<
  ValidLoginInput,
  Extract<AuthField, "email" | "password">,
  AuthValidationIssueCode
> {
  const issues: ValidationIssue<
    Extract<AuthField, "email" | "password">,
    AuthValidationIssueCode
  >[] = [];
  const email = normalizeEmail(getString(input.email));
  const password = normalizePassword(input.password);

  if (!email) {
    addIssue(issues, "email", "emailRequired");
  } else if (email.length > authValidationLimits.emailMaxLength) {
    addIssue(issues, "email", "emailTooLong");
  } else if (!emailPattern.test(email)) {
    addIssue(issues, "email", "invalidEmail");
  }

  if (!password) {
    addIssue(issues, "password", "passwordRequired");
  } else if (password.length < authValidationLimits.passwordMinLength) {
    addIssue(issues, "password", "shortPassword");
  } else if (password.length > authValidationLimits.passwordMaxLength) {
    addIssue(issues, "password", "passwordTooLong");
  }

  if (issues.length > 0) {
    return { issues, ok: false };
  }

  return { data: { email, password }, ok: true };
}

export function validateSignupInput(
  input: SignupInput,
): ValidationResult<ValidSignupInput, AuthField, AuthValidationIssueCode> {
  const issues: ValidationIssue<AuthField, AuthValidationIssueCode>[] = [];
  const email = normalizeEmail(getString(input.email));
  const password = normalizePassword(input.password);
  const username = normalizeUsername(getString(input.username));
  const displayName = getString(input.displayName).trim() || username;

  if (!email) {
    addIssue(issues, "email", "emailRequired");
  } else if (email.length > authValidationLimits.emailMaxLength) {
    addIssue(issues, "email", "emailTooLong");
  } else if (!emailPattern.test(email)) {
    addIssue(issues, "email", "invalidEmail");
  }

  if (!username) {
    addIssue(issues, "username", "usernameRequired");
  } else if (username.length < authValidationLimits.usernameMinLength) {
    addIssue(issues, "username", "shortUsername");
  } else if (username.length > authValidationLimits.usernameMaxLength) {
    addIssue(issues, "username", "usernameTooLong");
  } else if (!usernamePattern.test(username)) {
    addIssue(issues, "username", "invalidUsername");
  }

  if (displayName.length > authValidationLimits.displayNameMaxLength) {
    addIssue(issues, "displayName", "displayNameTooLong");
  }

  if (!password) {
    addIssue(issues, "password", "passwordRequired");
  } else if (password.length < authValidationLimits.passwordMinLength) {
    addIssue(issues, "password", "shortPassword");
  } else if (password.length > authValidationLimits.passwordMaxLength) {
    addIssue(issues, "password", "passwordTooLong");
  }

  if (issues.length > 0) {
    return { issues, ok: false };
  }

  return { data: { displayName, email, password, username }, ok: true };
}

export function validateProfileSettingsInput(
  input: ProfileSettingsInput,
): ValidationResult<
  ValidProfileSettingsInput,
  ProfileSettingsField,
  ProfileSettingsValidationIssueCode
> {
  const issues: ValidationIssue<ProfileSettingsField, ProfileSettingsValidationIssueCode>[] = [];
  const displayName = getString(input.displayName).trim();
  const currentPassword = normalizePassword(input.currentPassword);
  const newPassword = normalizePassword(input.newPassword);
  const confirmPassword = normalizePassword(input.confirmPassword);
  const wantsToChangePassword = Boolean(currentPassword || newPassword || confirmPassword);

  if (!displayName) {
    addIssue(issues, "displayName", "displayNameRequired");
  } else if (displayName.length > authValidationLimits.displayNameMaxLength) {
    addIssue(issues, "displayName", "displayNameTooLong");
  }

  if (wantsToChangePassword) {
    if (!currentPassword) {
      addIssue(issues, "currentPassword", "currentPasswordRequired");
    }

    if (!newPassword) {
      addIssue(issues, "newPassword", "newPasswordRequired");
    } else if (newPassword.length < authValidationLimits.passwordMinLength) {
      addIssue(issues, "newPassword", "shortPassword");
    } else if (newPassword.length > authValidationLimits.passwordMaxLength) {
      addIssue(issues, "newPassword", "passwordTooLong");
    }

    if (!confirmPassword) {
      addIssue(issues, "confirmPassword", "confirmPasswordRequired");
    } else if (newPassword && newPassword !== confirmPassword) {
      addIssue(issues, "confirmPassword", "passwordMismatch");
    }
  }

  if (issues.length > 0) {
    return { issues, ok: false };
  }

  return {
    data: {
      currentPassword,
      displayName,
      newPassword,
      wantsToChangePassword,
    },
    ok: true,
  };
}
