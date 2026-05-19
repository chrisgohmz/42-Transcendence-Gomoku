"use client";

import type { ComponentType, CSSProperties, ReactNode } from "react";
import { GithubLoginButton, GoogleLoginButton } from "react-social-login-buttons";

import type { OAuthProviderId } from "@/lib/oauth-providers";

type SocialButtonComponent = ComponentType<{
  activeStyle?: CSSProperties;
  align?: "center" | "left" | "right";
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: VoidFunction;
  size?: string;
  style?: CSSProperties;
  type?: "button" | "submit" | "reset";
}>;

const providerButtons = {
  github: GithubLoginButton,
  google: GoogleLoginButton,
} satisfies Record<OAuthProviderId, SocialButtonComponent>;

const providerButtonStyles = {
  github: {
    activeStyle: { background: "#1f2328", transform: "translateY(1px)" },
    style: {
      background: "#24292f",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: "6px",
      boxShadow: "0 12px 26px rgba(0,0,0,0.22)",
      color: "#ffffff",
      fontSize: "15px",
      fontWeight: 900,
      margin: 0,
      width: "100%",
    },
  },
  google: {
    activeStyle: { background: "#f1f3f4", transform: "translateY(1px)" },
    style: {
      background: "#ffffff",
      border: "1px solid #dadce0",
      borderRadius: "6px",
      boxShadow: "0 10px 22px rgba(0,0,0,0.16)",
      color: "#1f1f1f",
      fontSize: "15px",
      fontWeight: 900,
      margin: 0,
      width: "100%",
    },
  },
} satisfies Record<
  OAuthProviderId,
  {
    activeStyle: CSSProperties;
    style: CSSProperties;
  }
>;

type OAuthSocialButtonProps = {
  busy?: boolean;
  children: ReactNode;
  disabled?: boolean;
  muted?: boolean;
  onClick: VoidFunction;
  provider: OAuthProviderId;
  size?: string;
};

export function OAuthSocialButton({
  busy = false,
  children,
  disabled = false,
  muted = false,
  onClick,
  provider,
  size = "48px",
}: OAuthSocialButtonProps) {
  const Button = providerButtons[provider];
  const buttonStyles = providerButtonStyles[provider];

  return (
    <Button
      activeStyle={buttonStyles.activeStyle}
      align="center"
      className="oauth-social-button"
      disabled={disabled}
      size={size}
      style={{
        ...buttonStyles.style,
        cursor: busy ? "wait" : disabled ? "not-allowed" : "pointer",
        opacity: muted || (disabled && !busy) ? 0.58 : 1,
      }}
      type="button"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
