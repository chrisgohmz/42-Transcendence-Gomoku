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
        // fall back to returning the raw body below
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

export async function GET() {
  const backendUrl =
    process.env["BACKEND_INTERNAL_URL"] ?? "http://backend:3001";
  try {
    const response = await fetch(`${backendUrl}/api/rooms`, {
      method: "GET",
      cache: "no-store",
    });
    const contentType = response.headers.get("content-type");
    const rawBody = await response.text();
    if (contentType?.includes("application/json")) {
      try {
        const data = rawBody ? JSON.parse(rawBody) : null;
        return Response.json(data, { status: response.status });
      } catch {}
    }
    return new Response(rawBody, {
      status: response.status,
      headers: contentType ? { "content-type": contentType } : undefined,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    return Response.json(
      {
        error: "failed_to_list_rooms",
        message,
        detail: message,
      },
      { status: 502 },
    );
  }
}
