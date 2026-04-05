export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request) {
  const backendUrl =
    process.env["BACKEND_INTERNAL_URL"] ?? "http://backend:3001";

  try {
    const init: RequestInit & { duplex?: "half" } = {
      method: "POST",
      headers: request.headers,
      body: request.body,
      cache: "no-store",
      duplex: "half",
    };

    const response = await fetch(`${backendUrl}/api/rooms`, init);

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    return Response.json(
      {
        error: "failed_to_create_room",
        message,
        detail: message,
      },
      {
        status: 502,
      },
    );
  }
}
