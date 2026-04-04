export const dynamic = "force-dynamic";

type CreateRoomBackendSuccess = {
  id?: string;
  roomId?: string;
};

type CreateRoomBackendError = {
  error?: string;
  detail?: string;
  message?: string;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function getForwardHeaders(request: Request): Headers {
  const headers = new Headers();
  const excludedHeaders = new Set([
    "connection",
    "content-length",
    "host",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]);

  for (const [key, value] of request.headers.entries()) {
    if (!excludedHeaders.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  return headers;
}

async function parseJsonSafely<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const backendUrl =
    process.env["BACKEND_INTERNAL_URL"] ?? "http://backend:3001";

  try {
    const body = await request.arrayBuffer();
    const response = await fetch(`${backendUrl}/api/rooms`, {
      method: "POST",
      headers: getForwardHeaders(request),
      body: body.byteLength > 0 ? body : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorPayload =
        await parseJsonSafely<CreateRoomBackendError>(response);
      const message =
        errorPayload?.message ??
        errorPayload?.detail ??
        `Backend responded with status ${response.status}`;

      return Response.json(
        {
          error: errorPayload?.error ?? "failed_to_create_room",
          message,
          detail: errorPayload?.detail ?? message,
        },
        {
          status: response.status,
        },
      );
    }

    const successPayload =
      await parseJsonSafely<CreateRoomBackendSuccess>(response);
    const roomId = successPayload?.roomId ?? successPayload?.id;

    if (!roomId) {
      return Response.json(
        {
          error: "invalid_backend_response",
          message: "room id is missing in backend response",
          detail: "room id is missing in backend response",
        },
        {
          status: 502,
        },
      );
    }

    return Response.json(
      {
        roomId,
      },
      {
        status: response.status,
      },
    );
  } catch (error) {
    return Response.json(
      {
        error: "failed_to_create_room",
        message: getErrorMessage(error),
        detail: getErrorMessage(error),
      },
      {
        status: 503,
      },
    );
  }
}
