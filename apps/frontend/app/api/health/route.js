export const dynamic = "force-dynamic";

export async function GET() {
  const backendUrl = process.env.BACKEND_INTERNAL_URL || "http://backend:3001";

  try {
    const response = await fetch(`${backendUrl}/api/health`, {
      cache: "no-store",
    });
    const backend = await response.json();

    return Response.json(
      {
        service: "frontend",
        status: response.ok ? "ok" : "degraded",
        backend,
        checkedAt: new Date().toISOString(),
      },
      { status: response.ok ? 200 : 503 },
    );
  } catch (error) {
    return Response.json(
      {
        service: "frontend",
        status: "degraded",
        backend: {
          status: "unreachable",
          error: error.message,
        },
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
