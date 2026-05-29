export type OAuthCallbackErrorKey =
  | "accountAlreadyLinked"
  | "accountNotLinked"
  | "emailMismatch"
  | "generic"
  | "unableToLink";

type SearchParamValue = string | string[] | undefined;

const oauthCallbackErrorKeys: Record<string, OAuthCallbackErrorKey> = {
  account_already_linked_to_different_user: "accountAlreadyLinked",
  account_not_linked: "accountNotLinked",
  "email_doesn't_match": "emailMismatch",
  email_doesnt_match: "emailMismatch",
  linking_different_emails_not_allowed: "emailMismatch",
  linking_failed: "unableToLink",
  linking_not_allowed: "unableToLink",
  unable_to_link_account: "unableToLink",
};

function getFirstSearchParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function getOAuthCallbackErrorKey(value: SearchParamValue): OAuthCallbackErrorKey | null {
  const error = getFirstSearchParam(value)?.trim().toLowerCase();

  if (!error) {
    return null;
  }

  return oauthCallbackErrorKeys[error] ?? "generic";
}
