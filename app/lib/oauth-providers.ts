export const oauthProviderIds = ["github", "google"] as const;

export type OAuthProviderId = (typeof oauthProviderIds)[number];

export const oauthProviderLabels: Record<OAuthProviderId, string> = {
  github: "GitHub",
  google: "Google",
};
