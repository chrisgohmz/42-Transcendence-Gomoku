import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function POST()
{
	const room = await prisma.room.create({
		data: {}
	});
	return Response.json({
		id: room.id,
		status: room.status,
		createdAt: room.createdAt
	})
}
