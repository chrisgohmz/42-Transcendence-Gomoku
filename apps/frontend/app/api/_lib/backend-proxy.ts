const backendUrl = process.env["BACKEND_INTERNAL_URL"] ?? "http://backend:3001";

function shouldSendBody(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function mergeHeaders(request: Request, init?: RequestInit): Headers {
  const merged = new Headers(init?.headers ?? {});
  const incoming = new Headers(request.headers);

  const cookie = incoming.get("cookie");

  if (cookie && !merged.has("cookie")) {
    merged.set("cookie", cookie);
  }

  const contentType = incoming.get("content-type");

  if (contentType && !merged.has("content-type")) {
    merged.set("content-type", contentType);
  }

  return merged;
}

export async function proxyToBackend(
  request: Request,
  path: string,
  init?: RequestInit,
) {
  const target = new URL(path, backendUrl).toString();
  const method = (init?.method ?? request.method).toUpperCase();
  const headers = mergeHeaders(request, init);
  const body =
    init?.body ?? (shouldSendBody(method) ? request.body : undefined);

  const response = await fetch(target, {
    method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual",
  });

  const outgoingHeaders = new Headers();

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      return;
    }

    outgoingHeaders.set(key, value);
  });

  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    outgoingHeaders.append("set-cookie", cookie);
  }

  return new Response(response.body, {
    status: response.status,
    headers: outgoingHeaders,
  });
}

export function backendErrorResponse(message: string, status = 502) {
  return Response.json(
    {
      error: "backend_unavailable",
      message,
    },
    { status },
  );
}
