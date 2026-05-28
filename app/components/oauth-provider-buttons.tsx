"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { OAuthFeedbackAlert } from "@/components/oauth-feedback-alert";
import { OAuthSocialButton } from "@/components/oauth-social-button";
import { authClient } from "@/lib/auth-client";
import { oauthProviderLabels, type OAuthProviderId } from "@/lib/oauth-providers";

type OAuthProviderButtonsProps = {
  callbackPath: string;
  errorPath: string;
  initialErrorMessage?: string | null;
  providers: OAuthProviderId[];
};

export function OAuthProviderButtons({
  callbackPath,
  errorPath,
  initialErrorMessage = null,
  providers,
}: OAuthProviderButtonsProps) {
  const t = useTranslations("auth.oauth");
  const [pendingProvider, setPendingProvider] = useState<OAuthProviderId | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage);

  useEffect(() => {
    setErrorMessage(initialErrorMessage);
  }, [initialErrorMessage]);

  if (!providers.length) {
    return null;
  }

  async function handleSignIn(provider: OAuthProviderId) {
    setPendingProvider(provider);
    setErrorMessage(null);

    const { error } = await authClient.signIn.social({
      callbackURL: callbackPath,
      errorCallbackURL: errorPath,
      provider,
    });

    if (error) {
      setPendingProvider(null);
      setErrorMessage(t("startError", { provider: oauthProviderLabels[provider] }));
    }
  }

  return (
    <div className="grid gap-2">
      {providers.map((provider) => {
        const isPending = pendingProvider === provider;

        return (
          <OAuthSocialButton
            key={provider}
            ariaLabel={t("continueWithProvider", { provider: oauthProviderLabels[provider] })}
            busy={isPending}
            disabled={Boolean(pendingProvider)}
            muted={Boolean(pendingProvider && !isPending)}
            provider={provider}
            onClick={() => void handleSignIn(provider)}
          >
            {t("continueWithProvider", { provider: oauthProviderLabels[provider] })}
          </OAuthSocialButton>
        );
      })}

      {errorMessage ? <OAuthFeedbackAlert>{errorMessage}</OAuthFeedbackAlert> : null}
    </div>
  );
}
