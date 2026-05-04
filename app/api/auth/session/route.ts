import { getTranslations } from "next-intl/server";

import { apiErrorResponse } from "../../../lib/api-errors";
import { getCurrentSession, serializeUserForResponse } from "../../../lib/auth";
import { resolveApiLocale } from "../../../lib/i18n/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getCurrentSession();
  const t = await getTranslations({ locale: resolveApiLocale(request), namespace: "auth.errors" });

  if (!context) {
    return apiErrorResponse({ error: "unauthorized", message: t("unauthorized") }, 401);
  }

  return Response.json({
    user: serializeUserForResponse(context.user),
    session: {
      id: context.session.id,
      expiresAt: context.session.expiresAt.toISOString(),
      createdAt: context.session.createdAt.toISOString(),
    },
  });
}
