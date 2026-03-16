import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      service: "backend",
      status: "ok",
      database: "ok",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        service: "backend",
        status: "degraded",
        database: "unreachable",
        error: error.message,
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
