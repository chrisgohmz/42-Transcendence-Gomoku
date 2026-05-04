import type { AuthField } from "@/lib/validation/auth-profile";

type AuthFieldErrors = Partial<Record<AuthField, string[]>>;

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
  username: string;
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
  username: "",
};
