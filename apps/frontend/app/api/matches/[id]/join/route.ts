export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const backendUrl =
    process.env["BACKEND_INTERNAL_URL"] ?? "http://backend:3001";
  const { id } = await params;

  try {
    const response = await fetch(`${backendUrl}/api/matches/${id}/join`, {
      method: "POST",
      headers: request.headers,
      body: await request.text(),
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type");

    if (response.status === 204 || response.status === 205) {
      return new Response(null, { status: response.status });
    }

    const rawBody = await response.text();

    if (contentType?.includes("application/json")) {
      try {
        const data = rawBody ? JSON.parse(rawBody) : null;
        return Response.json(data, { status: response.status });
      } catch {
        // fallback
      }
    }

    return new Response(rawBody, {
      status: response.status,
      headers: contentType ? { "content-type": contentType } : undefined,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    return Response.json(
      {
        error: "failed_to_join_match",
        message,
        detail: message,
      },
      { status: 502 },
    );
  }
}
