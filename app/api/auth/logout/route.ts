import {
  clearSessionCookie,
  getCurrentSession,
  revokeSession,
} from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const context = await getCurrentSession();

  if (context) {
    await revokeSession(context.session.sessionToken);
  }

  await clearSessionCookie();

  return Response.json({ success: true });
}
