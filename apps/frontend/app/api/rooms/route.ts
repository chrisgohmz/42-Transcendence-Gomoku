export const dynamic = "force-dynamic";

export async function POST() {
  const backendUrl = process.env.BACKEND_INTERNAL_URL ?? "http://backend:3001";

  try {
    const response = await fetch(`${backendUrl}/api/rooms`,{
      method: "POST",
      cache: "no-store",
    });

    return response;
  }
  catch (error) {
    return Response.json({
      error: "failed_to_create_room"
    },
    {
      status: 500 
    });
  }
}