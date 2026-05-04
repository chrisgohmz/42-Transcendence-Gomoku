import { isAPIError } from "better-auth/api";
import { getTranslations } from "next-intl/server";

import { apiErrorResponse, getErrorMessage } from "../../../lib/api-errors";
import {
  auth,
  getDuplicateSignupFields as findDuplicateSignupFields,
  serializeUserForResponse,
} from "../../../lib/auth";
import {
  getDuplicateSignupFieldErrors,
  hasDuplicateSignupFields,
} from "../../../lib/auth-duplicate-fields";
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
    const duplicateFields = await findDuplicateSignupFields(
      validation.data.email,
      validation.data.username,
    );

    if (hasDuplicateSignupFields(duplicateFields)) {
      return apiErrorResponse(
        {
          error: "duplicate_account",
          fields: getDuplicateSignupFieldErrors(duplicateFields, t),
          message: t("duplicateAccount"),
        },
        409,
      );
    }

    const { headers, response } = await auth.api.signUpEmail({
      body: {
        email: validation.data.email,
        name: validation.data.displayName,
        password: validation.data.password,
        username: validation.data.username,
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
          error: "signup_failed",
          message: t("signupUnavailable"),
        },
        500,
      );
    }

    return Response.json({ user: serializeUserForResponse(user) }, { headers, status: 201 });
  } catch (error) {
    if (isAPIError(error)) {
      const duplicateFields = await findDuplicateSignupFields(
        validation.data.email,
        validation.data.username,
      ).catch(() => ({}));

      if (hasDuplicateSignupFields(duplicateFields)) {
        return apiErrorResponse(
          {
            error: "duplicate_account",
            fields: getDuplicateSignupFieldErrors(duplicateFields, t),
            message: t("duplicateAccount"),
          },
          409,
        );
      }
    }

    if (error instanceof Error && error.message.includes("Unique constraint")) {
      const duplicateFields = await findDuplicateSignupFields(
        validation.data.email,
        validation.data.username,
      ).catch(() => ({}));

      return apiErrorResponse(
        {
          error: "duplicate_account",
          fields: getDuplicateSignupFieldErrors(duplicateFields, t),
          message: t("duplicateAccount"),
        },
        409,
      );
    }

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
