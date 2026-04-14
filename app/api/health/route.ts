import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

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
    return Response.json(
      {
        service: "app",
        status: "degraded",
        database: "unreachable",
        error: getErrorMessage(error),
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
