import { getTranslations } from "next-intl/server";

import {
  apiErrorResponse,
  getErrorMessage,
  getPrismaUniqueConstraintFields,
  isPrismaUniqueConstraintError,
} from "../../../lib/api-errors";
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  serializeUserForResponse,
} from "../../../lib/auth";
import { resolveApiLocale } from "../../../lib/i18n/api";
import { prisma } from "../../../lib/prisma";
import { fieldIssuesToMap, validateSignupInput } from "../../../lib/validation/auth-profile";

export const dynamic = "force-dynamic";

type SignupBody = {
  displayName?: unknown;
  email?: unknown;
  password?: unknown;
  username?: unknown;
};

function getDuplicateSignupFields(
  error: unknown,
  t: (key: "duplicateAccount" | "duplicateEmail" | "duplicateUsername") => string,
) {
  if (!isPrismaUniqueConstraintError(error)) {
    return {};
  }

  const targetFields = getPrismaUniqueConstraintFields(error);
  const fields: Partial<Record<"email" | "username", string[]>> = {};

  if (targetFields.includes("email")) {
    fields.email = [t("duplicateEmail")];
  }

  if (targetFields.includes("username")) {
    fields.username = [t("duplicateUsername")];
  }

  return Object.keys(fields).length > 0
    ? fields
    : {
        email: [t("duplicateAccount")],
        username: [t("duplicateAccount")],
      };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SignupBody | null;
  const t = await getTranslations({ locale: resolveApiLocale(request), namespace: "auth.errors" });

  if (!body) {
    return apiErrorResponse({ error: "invalid_request", message: t("invalidRequestBody") }, 400);
  }

  const validation = validateSignupInput(body);

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
    const passwordHash = await hashPassword(validation.data.password);

    const user = await prisma.user.create({
      data: {
        email: validation.data.email,
        username: validation.data.username,
        displayName: validation.data.displayName,
        passwordHash,
        profile: {
          create: {},
        },
      },
    });

    await createSession(user.id, request);

    return Response.json({ user: serializeUserForResponse(user) }, { status: 201 });
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return apiErrorResponse(
        {
          error: "duplicate_account",
          fields: getDuplicateSignupFields(error, t),
          message: t("duplicateAccount"),
        },
        409,
      );
    }

    await clearSessionCookie();

    return apiErrorResponse(
      {
        error: "signup_failed",
        detail: getErrorMessage(error),
        message: t("signupUnavailable"),
      },
      500,
    );
  }
}
