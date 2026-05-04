import type { ProfileSettingsField } from "@/lib/validation/auth-profile";

export type ProfileSettingsActionState = {
  fields: Partial<Record<ProfileSettingsField, string[]>>;
  message: string | null;
  successMessage: string | null;
};

export const initialProfileSettingsActionState: ProfileSettingsActionState = {
  fields: {},
  message: null,
  successMessage: null,
};
