import { prisma } from "../../../lib/prisma";

export const dynamic = "force-dynamic";

export async function POST()
{
	try {
		const room = await prisma.room.create({
			data: {}
		});
		return Response.json({
			id: room.id,
			status: room.status,
			createdAt: room.createdAt
		})
	}
	catch (error){
		return Response.json({
			error: "failed_to_create_room"
		},
		{
			status: 500
		})
	}
}
