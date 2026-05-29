"use client";

import type { ReactNode } from "react";

import type { OAuthProviderId } from "@/lib/oauth-providers";
import { cn } from "@/lib/utils";

const providerButtonClasses = {
  github: "oauth-social-button-github",
  google: "oauth-social-button-google",
} satisfies Record<OAuthProviderId, string>;

type OAuthSocialButtonProps = {
  ariaLabel: string;
  busy?: boolean;
  children: ReactNode;
  disabled?: boolean;
  muted?: boolean;
  onClick: VoidFunction;
  provider: OAuthProviderId;
  size?: "44px" | "48px";
};

export function OAuthSocialButton({
  ariaLabel,
  busy = false,
  children,
  disabled = false,
  muted = false,
  onClick,
  provider,
  size = "48px",
}: OAuthSocialButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      aria-busy={busy || undefined}
      className={cn(
        "oauth-social-button",
        size === "44px" && "oauth-social-button-compact",
        providerButtonClasses[provider],
      )}
      data-busy={busy ? "true" : undefined}
      data-muted={muted || (disabled && !busy) ? "true" : undefined}
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <span className="oauth-social-button-row">
        <span className="oauth-provider-icon" aria-hidden="true">
          {provider === "github" ? <GitHubIcon /> : <GoogleIcon />}
        </span>
        <span className="min-w-0 truncate">{children}</span>
      </span>
    </button>
  );
}

function GitHubIcon() {
  return (
    <svg
      className="oauth-provider-svg oauth-provider-github-mark"
      viewBox="0 0 24 24"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.6 4.2 18.6 4.5 18.6 4.5c.6 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.2v4.1c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg
      className="oauth-provider-svg oauth-provider-google-mark"
      viewBox="0 0 48 48"
      focusable="false"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.7 1.2 9.2 3.6l6.8-6.9C35.9 2.4 30.5 0 24 0 14.6 0 6.5 5.4 2.6 13.2l8 6.2C12.5 13.5 17.8 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.4a10.6 10.6 0 0 1-4.6 7v5.7h7.4c4.3-4 6.9-9.9 6.9-16.7Z"
      />
      <path fill="#FBBC05" d="M10.6 28.6a14.4 14.4 0 0 1 0-9.2v-6.2h-8a24 24 0 0 0 0 21.6l8-6.2Z" />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2 1.4-4.7 2.2-8.5 2.2-6.2 0-11.5-4-13.4-9.5l-8 6.2C6.5 42.6 14.6 48 24 48Z"
      />
    </svg>
  );
}
