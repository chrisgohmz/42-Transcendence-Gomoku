import {
  getCurrentSession,
  refreshSessionIfNeeded,
  serializeUserForResponse,
} from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getCurrentSession();

  if (!context) {
    return Response.json(
      { error: "unauthorized", message: "You need to sign in first." },
      { status: 401 },
    );
  }

  await refreshSessionIfNeeded(context);

  return Response.json({
    user: serializeUserForResponse(context.user),
    session: {
      id: context.session.id,
      expiresAt: context.session.expiresAt.toISOString(),
      createdAt: context.session.createdAt.toISOString(),
    },
  });
}
