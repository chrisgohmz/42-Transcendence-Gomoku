export type LoginActionState = {
  email: string;
  message: string | null;
};

export type SignupActionState = {
  displayName: string;
  email: string;
  message: string | null;
  username: string;
};

export const initialLoginActionState: LoginActionState = {
  email: "",
  message: null,
};

export const initialSignupActionState: SignupActionState = {
  displayName: "",
  email: "",
  message: null,
  username: "",
};
