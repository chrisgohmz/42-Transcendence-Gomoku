import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

type OAuthFeedbackAlertProps = {
  children: ReactNode;
};

export function OAuthFeedbackAlert({ children }: OAuthFeedbackAlertProps) {
  return (
    <p className="oauth-feedback-alert" role="alert" aria-live="polite">
      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
