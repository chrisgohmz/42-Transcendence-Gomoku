import { prisma } from "../../lib/prisma";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      service: "app",
      status: "ok",
      database: "ok",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[api/health] database check failed:", getErrorMessage(error));
    return Response.json(
      {
        service: "app",
        status: "degraded",
        database: "unreachable",
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
