import { isAPIError } from "better-auth/api";
import { getTranslations } from "next-intl/server";

import { apiErrorResponse } from "../../../lib/api-errors";
import { auth, serializeUserForResponse } from "../../../lib/auth";
import { getLocalizedAuthAppUrl } from "../../../lib/auth-urls";
import { resolveApiLocale } from "../../../lib/i18n/api";
import { prisma } from "../../../lib/prisma";
import { enforceRateLimit } from "../../../lib/rate-limit";
import { rateLimitRule } from "../../../lib/rate-limit-rules";
import { enforceMutationRequest } from "../../../lib/request-security";
import { fieldIssuesToMap, validateLoginInput } from "../../../lib/validation/auth-profile";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

function getLocalizedProfileUrl(request: Request): string {
  const locale = resolveApiLocale(request);
  return getLocalizedAuthAppUrl(locale, "/profile", {
    headers: request.headers,
    requestUrl: request.url,
  });
}

function isEmailNotVerifiedError(error: unknown): boolean {
  return (
    isAPIError(error) &&
    error.statusCode === 403 &&
    (error.body as { code?: string } | undefined)?.code === "EMAIL_NOT_VERIFIED"
  );
}

export async function POST(request: Request) {
  const requestGuardResponse = enforceMutationRequest(request, { requireJson: true });

  if (requestGuardResponse) {
    return requestGuardResponse;
  }

  const rateLimitExceededResponse = await enforceRateLimit(
    request.headers,
    rateLimitRule("authLogin"),
  );

  if (rateLimitExceededResponse) {
    return rateLimitExceededResponse;
  }

  const body = (await request.json().catch(() => null)) as LoginBody | null;
  const t = await getTranslations({ locale: resolveApiLocale(request), namespace: "auth.errors" });

  if (!body) {
    return apiErrorResponse({ error: "invalid_request", message: t("invalidRequestBody") }, 400);
  }

  const validation = validateLoginInput(body);

  if (!validation.ok) {
    return apiErrorResponse(
      {
        error: "validation_failed",
        fields: fieldIssuesToMap(validation.issues, t),
        message: t("fixHighlightedFields"),
      },
      400,
    );
  }

  try {
    const { headers, response } = await auth.api.signInEmail({
      body: {
        callbackURL: getLocalizedProfileUrl(request),
        email: validation.data.email,
        password: validation.data.password,
      },
      headers: request.headers,
      request,
      returnHeaders: true,
    });

    const user = await prisma.user.findUnique({
      where: { id: response.user.id },
    });

    if (!user) {
      return apiErrorResponse(
        {
          error: "login_failed",
          message: t("loginUnavailable"),
        },
        500,
      );
    }

    return Response.json({ user: serializeUserForResponse(user) }, { headers });
  } catch (error) {
    if (isEmailNotVerifiedError(error)) {
      return apiErrorResponse(
        {
          error: "email_not_verified",
          message: t("emailNotVerified"),
        },
        403,
      );
    }

    if (isAPIError(error)) {
      return apiErrorResponse(
        {
          error: "invalid_credentials",
          message: t("invalidCredentials"),
        },
        401,
      );
    }

    return apiErrorResponse(
      {
        error: "login_failed",
        message: t("loginUnavailable"),
      },
      500,
    );
  }
}
