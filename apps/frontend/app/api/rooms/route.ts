export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(request: Request) {
  const backendUrl =
    process.env["BACKEND_INTERNAL_URL"] ?? "http://backend:3001";

  try {
    const response = await fetch(`${backendUrl}/api/rooms`, {
      method: "POST",
      headers: request.headers,
      body: request.body,
      cache: "no-store",
    });

    const data = await response.json();
    return Response.json(data, { status: response.status });
  } catch (error) {
    return Response.json(
      {
        error: "failed_to_create_room",
        detail: getErrorMessage(error),
      },
      {
        status: 500,
      },
    );
  }
}
