import { z } from "zod";

import { authValidationLimits } from "./auth-profile-limits";

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

const authFields: readonly AuthField[] = ["displayName", "email", "password", "username"];
const loginFields: readonly Extract<AuthField, "email" | "password">[] = ["email", "password"];
const profileSettingsFields: readonly ProfileSettingsField[] = [
  "confirmPassword",
  "currentPassword",
  "displayName",
  "newPassword",
];
const authIssueCodes: readonly AuthValidationIssueCode[] = [
  "displayNameTooLong",
  "emailRequired",
  "emailTooLong",
  "invalidEmail",
  "invalidUsername",
  "passwordRequired",
  "passwordTooLong",
  "shortPassword",
  "shortUsername",
  "usernameRequired",
  "usernameTooLong",
];
const profileSettingsIssueCodes: readonly ProfileSettingsValidationIssueCode[] = [
  "confirmPasswordRequired",
  "currentPasswordRequired",
  "displayNameRequired",
  "displayNameTooLong",
  "newPasswordRequired",
  "passwordMismatch",
  "passwordTooLong",
  "shortPassword",
];

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

function objectFromUnknown<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.preprocess(
    (value) => (typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}),
    z.object(shape),
  );
}

const normalizedStringSchema = z.unknown().optional().transform(getString);
const normalizedEmailSchema = normalizedStringSchema.transform(normalizeEmail);
const normalizedPasswordSchema = normalizedStringSchema.transform(normalizePassword);
const normalizedUsernameSchema = normalizedStringSchema.transform(normalizeUsername);
const trimmedStringSchema = normalizedStringSchema.transform((value) => value.trim());

function addZodIssue<Field extends string, Code extends string>(
  ctx: z.RefinementCtx,
  field: Field,
  code: Code,
) {
  ctx.addIssue({
    code: "custom",
    message: code,
    path: [field],
  });
}

function hasKnownField<Field extends string>(
  value: unknown,
  fields: readonly Field[],
): value is Field {
  return typeof value === "string" && fields.includes(value as Field);
}

function hasKnownCode<Code extends string>(value: string, codes: readonly Code[]): value is Code {
  return codes.includes(value as Code);
}

function zodIssuesToValidationIssues<Field extends string, Code extends string>(
  issues: z.core.$ZodIssue[],
  fields: readonly Field[],
  codes: readonly Code[],
): ValidationIssue<Field, Code>[] {
  return issues.flatMap((issue) => {
    const [field] = issue.path;

    if (!hasKnownField(field, fields) || !hasKnownCode(issue.message, codes)) {
      return [];
    }

    return [{ code: issue.message, field }];
  });
}

function zodResultToValidationResult<Data, Field extends string, Code extends string>(
  result: z.ZodSafeParseResult<Data>,
  fields: readonly Field[],
  codes: readonly Code[],
): ValidationResult<Data, Field, Code> {
  if (result.success) {
    return { data: result.data, ok: true };
  }

  return {
    issues: zodIssuesToValidationIssues(result.error.issues, fields, codes),
    ok: false,
  };
}

const loginInputSchema = objectFromUnknown({
  email: normalizedEmailSchema,
  password: normalizedPasswordSchema,
}).superRefine((input, ctx) => {
  if (!input.email) {
    addZodIssue(ctx, "email", "emailRequired");
  } else if (input.email.length > authValidationLimits.emailMaxLength) {
    addZodIssue(ctx, "email", "emailTooLong");
  } else if (!emailPattern.test(input.email)) {
    addZodIssue(ctx, "email", "invalidEmail");
  }

  if (!input.password) {
    addZodIssue(ctx, "password", "passwordRequired");
  } else if (input.password.length < authValidationLimits.passwordMinLength) {
    addZodIssue(ctx, "password", "shortPassword");
  } else if (input.password.length > authValidationLimits.passwordMaxLength) {
    addZodIssue(ctx, "password", "passwordTooLong");
  }
});

const signupInputSchema = objectFromUnknown({
  displayName: trimmedStringSchema,
  email: normalizedEmailSchema,
  password: normalizedPasswordSchema,
  username: normalizedUsernameSchema,
})
  .superRefine((input, ctx) => {
    const displayName = input.displayName || input.username;

    if (!input.email) {
      addZodIssue(ctx, "email", "emailRequired");
    } else if (input.email.length > authValidationLimits.emailMaxLength) {
      addZodIssue(ctx, "email", "emailTooLong");
    } else if (!emailPattern.test(input.email)) {
      addZodIssue(ctx, "email", "invalidEmail");
    }

    if (!input.username) {
      addZodIssue(ctx, "username", "usernameRequired");
    } else if (input.username.length < authValidationLimits.usernameMinLength) {
      addZodIssue(ctx, "username", "shortUsername");
    } else if (input.username.length > authValidationLimits.usernameMaxLength) {
      addZodIssue(ctx, "username", "usernameTooLong");
    } else if (!usernamePattern.test(input.username)) {
      addZodIssue(ctx, "username", "invalidUsername");
    }

    if (displayName.length > authValidationLimits.displayNameMaxLength) {
      addZodIssue(ctx, "displayName", "displayNameTooLong");
    }

    if (!input.password) {
      addZodIssue(ctx, "password", "passwordRequired");
    } else if (input.password.length < authValidationLimits.passwordMinLength) {
      addZodIssue(ctx, "password", "shortPassword");
    } else if (input.password.length > authValidationLimits.passwordMaxLength) {
      addZodIssue(ctx, "password", "passwordTooLong");
    }
  })
  .transform((input) => ({
    displayName: input.displayName || input.username,
    email: input.email,
    password: input.password,
    username: input.username,
  }));

const profileSettingsInputSchema = objectFromUnknown({
  confirmPassword: normalizedPasswordSchema,
  currentPassword: normalizedPasswordSchema,
  displayName: trimmedStringSchema,
  newPassword: normalizedPasswordSchema,
})
  .superRefine((input, ctx) => {
    const wantsToChangePassword = Boolean(
      input.currentPassword || input.newPassword || input.confirmPassword,
    );

    if (!input.displayName) {
      addZodIssue(ctx, "displayName", "displayNameRequired");
    } else if (input.displayName.length > authValidationLimits.displayNameMaxLength) {
      addZodIssue(ctx, "displayName", "displayNameTooLong");
    }

    if (!wantsToChangePassword) {
      return;
    }

    if (!input.currentPassword) {
      addZodIssue(ctx, "currentPassword", "currentPasswordRequired");
    }

    if (!input.newPassword) {
      addZodIssue(ctx, "newPassword", "newPasswordRequired");
    } else if (input.newPassword.length < authValidationLimits.passwordMinLength) {
      addZodIssue(ctx, "newPassword", "shortPassword");
    } else if (input.newPassword.length > authValidationLimits.passwordMaxLength) {
      addZodIssue(ctx, "newPassword", "passwordTooLong");
    }

    if (!input.confirmPassword) {
      addZodIssue(ctx, "confirmPassword", "confirmPasswordRequired");
    } else if (input.newPassword && input.newPassword !== input.confirmPassword) {
      addZodIssue(ctx, "confirmPassword", "passwordMismatch");
    }
  })
  .transform((input) => ({
    currentPassword: input.currentPassword,
    displayName: input.displayName,
    newPassword: input.newPassword,
    wantsToChangePassword: Boolean(
      input.currentPassword || input.newPassword || input.confirmPassword,
    ),
  }));

export type ValidLoginInput = z.infer<typeof loginInputSchema>;
export type ValidSignupInput = z.infer<typeof signupInputSchema>;
export type ValidProfileSettingsInput = z.infer<typeof profileSettingsInputSchema>;

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
  return zodResultToValidationResult(
    loginInputSchema.safeParse(input),
    loginFields,
    authIssueCodes,
  );
}

export function validateSignupInput(
  input: SignupInput,
): ValidationResult<ValidSignupInput, AuthField, AuthValidationIssueCode> {
  return zodResultToValidationResult(
    signupInputSchema.safeParse(input),
    authFields,
    authIssueCodes,
  );
}

export function validateProfileSettingsInput(
  input: ProfileSettingsInput,
): ValidationResult<
  ValidProfileSettingsInput,
  ProfileSettingsField,
  ProfileSettingsValidationIssueCode
> {
  return zodResultToValidationResult(
    profileSettingsInputSchema.safeParse(input),
    profileSettingsFields,
    profileSettingsIssueCodes,
  );
}
