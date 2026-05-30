import "server-only";
import { prisma } from "@/lib/prisma";
import { normalizeProfileAvatarImage } from "@/lib/profile-avatar-image";
import {
  createProfileAvatarFilename,
  deleteProfileAvatarFile,
  deleteProfileAvatarFileByUrl,
  getProfileAvatarUrl,
  writeProfileAvatarFile,
} from "@/lib/profile-avatar-storage";
import { isSeedProfileAvatarUrl } from "@/lib/seed-avatars";

export async function saveProfileAvatar(userId: string, input: Buffer) {
  const normalizedImage = await normalizeProfileAvatarImage(input);

  if (!normalizedImage) {
    return false;
  }

  const previousUser = await prisma.user.findUnique({
    select: { avatarUrl: true },
    where: { id: userId },
  });
  const filename = createProfileAvatarFilename(normalizedImage.extension);
  const fileUrl = getProfileAvatarUrl(filename);

  if (!fileUrl) {
    throw new Error("Invalid profile avatar filename");
  }

  await writeProfileAvatarFile(filename, normalizedImage.buffer);

  try {
    await prisma.user.update({
      data: { avatarUrl: fileUrl },
      where: { id: userId },
    });
  } catch (error) {
    await deleteProfileAvatarFile(filename).catch(() => undefined);
    throw error;
  }

  if (previousUser?.avatarUrl) {
    await deleteProfileAvatarFileByUrl(previousUser.avatarUrl).catch(() => undefined);
  }

  return true;
}

export async function saveProfileSeedAvatar(userId: string, avatarUrl: string) {
  if (!isSeedProfileAvatarUrl(avatarUrl)) {
    return false;
  }

  const previousUser = await prisma.user.findUnique({
    select: { avatarUrl: true },
    where: { id: userId },
  });

  await prisma.user.update({
    data: { avatarUrl },
    where: { id: userId },
  });

  if (previousUser?.avatarUrl && previousUser.avatarUrl !== avatarUrl) {
    await deleteProfileAvatarFileByUrl(previousUser.avatarUrl).catch(() => undefined);
  }

  return true;
}
