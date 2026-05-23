import type {
  AuthField,
  PasswordResetConfirmField,
  PasswordResetRequestField,
} from "@/lib/validation/auth-profile";

type AuthFieldErrors = Partial<Record<AuthField, string[]>>;
type PasswordResetRequestFieldErrors = Partial<Record<PasswordResetRequestField, string[]>>;
type PasswordResetConfirmFieldErrors = Partial<Record<PasswordResetConfirmField, string[]>>;

export type LoginActionState = {
  email: string;
  fields: AuthFieldErrors;
  message: string | null;
};

export type SignupActionState = {
  displayName: string;
  email: string;
  fields: AuthFieldErrors;
  message: string | null;
  successMessage: string | null;
  username: string;
};

export type PasswordResetRequestActionState = {
  email: string;
  fields: PasswordResetRequestFieldErrors;
  message: string | null;
  successMessage: string | null;
};

export type PasswordResetConfirmActionState = {
  fields: PasswordResetConfirmFieldErrors;
  message: string | null;
  successMessage: string | null;
};

export const initialLoginActionState: LoginActionState = {
  email: "",
  fields: {},
  message: null,
};

export const initialSignupActionState: SignupActionState = {
  displayName: "",
  email: "",
  fields: {},
  message: null,
  successMessage: null,
  username: "",
};

export const initialPasswordResetRequestActionState: PasswordResetRequestActionState = {
  email: "",
  fields: {},
  message: null,
  successMessage: null,
};

export const initialPasswordResetConfirmActionState: PasswordResetConfirmActionState = {
  fields: {},
  message: null,
  successMessage: null,
};
