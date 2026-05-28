import "server-only";
import { getTranslations } from "next-intl/server";

import { getOAuthCallbackErrorKey } from "./oauth-callback-errors";

type OAuthCallbackSearchParams = Promise<
  | {
      error?: string | string[];
    }
  | undefined
>;

type OAuthCallbackErrorMessageOptions = {
  keyPrefix?: string;
  locale: string;
  namespace: "auth.oauth" | "profile.edit";
  searchParams?: OAuthCallbackSearchParams;
};

export async function getOAuthCallbackErrorMessage({
  keyPrefix = "callbackErrors",
  locale,
  namespace,
  searchParams,
}: OAuthCallbackErrorMessageOptions): Promise<string | null> {
  const query = (await searchParams) ?? {};
  const errorKey = getOAuthCallbackErrorKey(query.error);

  if (!errorKey) {
    return null;
  }

  const t = await getTranslations({ locale, namespace });

  return t(`${keyPrefix}.${errorKey}`);
}
