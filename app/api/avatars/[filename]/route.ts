import { getProfileAvatarContentType, readProfileAvatarFile } from "@/lib/profile-avatar-storage";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const contentType = getProfileAvatarContentType(filename);

  if (!contentType) {
    return new Response(null, { status: 404 });
  }

  const file = await readProfileAvatarFile(filename);

  if (!file) {
    return new Response(null, { status: 404 });
  }

  return new Response(new Uint8Array(file), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(file.byteLength),
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
