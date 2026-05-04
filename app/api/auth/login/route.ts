import { isAPIError } from "better-auth/api";
import { getTranslations } from "next-intl/server";

import { apiErrorResponse, getErrorMessage } from "../../../lib/api-errors";
import { auth, serializeUserForResponse } from "../../../lib/auth";
import { resolveApiLocale } from "../../../lib/i18n/api";
import { prisma } from "../../../lib/prisma";
import { fieldIssuesToMap, validateLoginInput } from "../../../lib/validation/auth-profile";

export const dynamic = "force-dynamic";

type LoginBody = {
  email?: unknown;
  password?: unknown;
};

export async function POST(request: Request) {
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
        detail: getErrorMessage(error),
        message: t("loginUnavailable"),
      },
      500,
    );
  }
}
