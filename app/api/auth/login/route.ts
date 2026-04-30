import { getTranslations } from "next-intl/server";

import { apiErrorResponse, getErrorMessage } from "../../../lib/api-errors";
import {
  clearSessionCookie,
  createSession,
  serializeUserForResponse,
  verifyPassword,
} from "../../../lib/auth";
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
    const user = await prisma.user.findUnique({
      where: { email: validation.data.email },
    });

    const isValid =
      user && (await verifyPassword(validation.data.password, user.passwordHash ?? null));

    if (!user || !isValid) {
      await clearSessionCookie();
      return apiErrorResponse(
        {
          error: "invalid_credentials",
          message: t("invalidCredentials"),
        },
        401,
      );
    }

    await createSession(user.id, request);

    return Response.json({ user: serializeUserForResponse(user) });
  } catch (error) {
    await clearSessionCookie();

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
