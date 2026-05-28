"use client";

import { Loader2, Unlink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OAuthFeedbackAlert } from "@/components/oauth-feedback-alert";
import { OAuthSocialButton } from "@/components/oauth-social-button";
import { authClient } from "@/lib/auth-client";
import { oauthProviderLabels, type OAuthProviderId } from "@/lib/oauth-providers";

export type OAuthProviderConnection = {
  accountId: string | null;
  canUnlink: boolean;
  configured: boolean;
  id: OAuthProviderId;
  linked: boolean;
};

type OAuthAccountConnectionsProps = {
  callbackPath?: string;
  initialMessage?: string | null;
  locale: string;
  providers: OAuthProviderConnection[];
};

export function OAuthAccountConnections({
  callbackPath = "/profile/edit",
  initialMessage = null,
  locale,
  providers,
}: OAuthAccountConnectionsProps) {
  const router = useRouter();
  const t = useTranslations("profile.edit.connections");
  const [pendingProvider, setPendingProvider] = useState<OAuthProviderId | null>(null);
  const [message, setMessage] = useState<string | null>(initialMessage);

  useEffect(() => {
    setMessage(initialMessage);
  }, [initialMessage]);

  async function connectProvider(provider: OAuthProviderConnection) {
    setPendingProvider(provider.id);
    setMessage(null);

    const { error } = await authClient.linkSocial({
      callbackURL: `/${locale}${callbackPath}`,
      errorCallbackURL: `/${locale}${callbackPath}`,
      provider: provider.id,
    });

    if (error) {
      setPendingProvider(null);
      setMessage(t("connectError", { provider: oauthProviderLabels[provider.id] }));
    }
  }

  async function disconnectProvider(provider: OAuthProviderConnection) {
    setPendingProvider(provider.id);
    setMessage(null);

    const { error } = await authClient.unlinkAccount({
      providerId: provider.id,
      ...(provider.accountId ? { accountId: provider.accountId } : {}),
    });

    setPendingProvider(null);

    if (error) {
      setMessage(t("disconnectError", { provider: oauthProviderLabels[provider.id] }));
      return;
    }

    router.refresh();
  }

  return (
    <div className="grid gap-4">
      <p className="m-0 text-sm leading-6 text-[var(--muted-text)]">{t("description")}</p>

      <div className="grid gap-3 md:grid-cols-2">
        {providers.map((provider) => {
          const isPending = pendingProvider === provider.id;
          const isConnecting = isPending && !provider.linked;
          const isDisconnecting = isPending && provider.linked;

          return (
            <div
              key={provider.id}
              className="flex flex-col gap-3 rounded-md border border-[var(--panel-border-soft)] bg-white/[0.035] p-3"
            >
              <div
                className="min-w-0"
                title={
                  provider.linked
                    ? t("connected")
                    : !provider.configured
                      ? t("notConfigured")
                      : undefined
                }
              >
                <OAuthSocialButton
                  ariaLabel={
                    isConnecting
                      ? t("connecting")
                      : provider.linked
                        ? t("connectedWithProvider", { provider: oauthProviderLabels[provider.id] })
                        : t("connectWithProvider", { provider: oauthProviderLabels[provider.id] })
                  }
                  busy={isConnecting}
                  disabled={Boolean(pendingProvider) || provider.linked || !provider.configured}
                  muted={provider.linked || Boolean(pendingProvider && !isPending)}
                  provider={provider.id}
                  size="44px"
                  onClick={() => void connectProvider(provider)}
                >
                  {isConnecting
                    ? t("connecting")
                    : provider.linked
                      ? t("connectedWithProvider", { provider: oauthProviderLabels[provider.id] })
                      : t("connectWithProvider", { provider: oauthProviderLabels[provider.id] })}
                </OAuthSocialButton>
                {isConnecting ? (
                  <output className="sr-only" aria-live="polite">
                    {t("connecting")}
                  </output>
                ) : null}
              </div>

              {provider.linked ? (
                <button
                  type="button"
                  className="btn btn-subtle m-0 min-h-10 w-full"
                  disabled={isDisconnecting || !provider.canUnlink}
                  title={!provider.canUnlink ? t("lastAccount") : undefined}
                  onClick={() => void disconnectProvider(provider)}
                >
                  {isDisconnecting ? (
                    <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                  ) : (
                    <Unlink aria-hidden="true" className="size-4" />
                  )}
                  {isDisconnecting ? t("disconnecting") : t("disconnect")}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {message ? <OAuthFeedbackAlert>{message}</OAuthFeedbackAlert> : null}
    </div>
  );
}
