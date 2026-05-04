import { headers } from "next/headers";

import { auth } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const authResponse = await auth.api
    .signOut({
      headers: await headers(),
      returnHeaders: true,
    })
    .catch(() => null);

  return Response.json(
    { success: true },
    authResponse ? { headers: authResponse.headers } : undefined,
  );
}
