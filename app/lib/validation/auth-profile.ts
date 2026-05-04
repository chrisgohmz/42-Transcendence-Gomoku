import { z } from "zod";

import { authValidationLimits } from "./auth-profile-limits";

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
  | "passwordTooLong"
  | "shortPassword"
  | "shortUsername"
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

export type ProfileDisplayNameInput = {
  displayName?: unknown;
};

export type ProfilePasswordInput = {
  confirmPassword?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
};

const authFields: readonly AuthField[] = ["displayName", "email", "password", "username"];
const loginFields: readonly Extract<AuthField, "email" | "password">[] = ["email", "password"];
const authIssueCodes: readonly AuthValidationIssueCode[] = [
  "displayNameTooLong",
  "emailRequired",
  "emailTooLong",
  "invalidEmail",
  "invalidUsername",
  "passwordTooLong",
  "shortPassword",
  "shortUsername",
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

function objectFromUnknown<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.preprocess(
    (value) => (typeof value === "object" && value !== null && !Array.isArray(value) ? value : {}),
    z.object(shape),
  );
}

const stringFromUnknownSchema = z.unknown().optional().transform(getString);
const optionalDisplayNameSchema = stringFromUnknownSchema.pipe(
  z.string().max(authValidationLimits.displayNameMaxLength, {
    abort: true,
    error: "displayNameTooLong",
  }),
);
const requiredDisplayNameSchema = stringFromUnknownSchema.pipe(
  z
    .string()
    .min(1, { abort: true, error: "displayNameRequired" })
    .max(authValidationLimits.displayNameMaxLength, {
      abort: true,
      error: "displayNameTooLong",
    }),
);
const emailSchema = stringFromUnknownSchema.pipe(
  z
    .string()
    .min(1, { abort: true, error: "emailRequired" })
    .max(authValidationLimits.emailMaxLength, { abort: true, error: "emailTooLong" })
    .toLowerCase()
    .pipe(z.email({ error: "invalidEmail" })),
);
const loginPasswordSchema = stringFromUnknownSchema.pipe(
  z
    .string()
    .min(authValidationLimits.passwordMinLength, { abort: true, error: "shortPassword" })
    .max(authValidationLimits.passwordMaxLength, { abort: true, error: "passwordTooLong" }),
);
const profilePasswordSchema = stringFromUnknownSchema;
const usernameSchema = stringFromUnknownSchema.pipe(
  z
    .string()
    .min(authValidationLimits.usernameMinLength, { abort: true, error: "shortUsername" })
    .max(authValidationLimits.usernameMaxLength, { abort: true, error: "usernameTooLong" })
    .regex(usernamePattern, { error: "invalidUsername" }),
);

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
  email: emailSchema,
  password: loginPasswordSchema,
});

const signupInputSchema = objectFromUnknown({
  email: emailSchema,
  username: usernameSchema,
  displayName: optionalDisplayNameSchema,
  password: loginPasswordSchema,
}).transform((input) => ({
  displayName: input.displayName || input.username,
  email: input.email,
  password: input.password,
  username: input.username,
}));

const profileDisplayNameInputSchema = objectFromUnknown({
  displayName: requiredDisplayNameSchema,
});

const profilePasswordInputSchema = objectFromUnknown({
  currentPassword: profilePasswordSchema,
  newPassword: profilePasswordSchema,
  confirmPassword: profilePasswordSchema,
}).superRefine((input, ctx) => {
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
});

export type ValidLoginInput = z.infer<typeof loginInputSchema>;
export type ValidSignupInput = z.infer<typeof signupInputSchema>;
export type ValidProfileDisplayNameInput = z.infer<typeof profileDisplayNameInputSchema>;
export type ValidProfilePasswordInput = z.infer<typeof profilePasswordInputSchema>;

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

export function validateProfileDisplayNameInput(
  input: ProfileDisplayNameInput,
): ValidationResult<
  ValidProfileDisplayNameInput,
  Extract<ProfileSettingsField, "displayName">,
  ProfileSettingsValidationIssueCode
> {
  return zodResultToValidationResult(
    profileDisplayNameInputSchema.safeParse(input),
    ["displayName"],
    profileSettingsIssueCodes,
  );
}

export function validateProfilePasswordInput(
  input: ProfilePasswordInput,
): ValidationResult<
  ValidProfilePasswordInput,
  Exclude<ProfileSettingsField, "displayName">,
  ProfileSettingsValidationIssueCode
> {
  return zodResultToValidationResult(
    profilePasswordInputSchema.safeParse(input),
    ["confirmPassword", "currentPassword", "newPassword"],
    profileSettingsIssueCodes,
  );
}
