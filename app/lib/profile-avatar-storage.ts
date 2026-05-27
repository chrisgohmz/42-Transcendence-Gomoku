import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  getProfileAvatarFormat,
  supportedProfileAvatarExtensions,
  type ProfileAvatarContentType,
  type SupportedProfileAvatarExtension,
} from "@/lib/profile-avatar-format";

const profileAvatarExtensionPattern = supportedProfileAvatarExtensions.join("|");
const profileAvatarFilenamePattern = new RegExp(
  `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${profileAvatarExtensionPattern})$`,
);
const profileAvatarRoutePrefix = "/api/avatars/";
const profileAvatarStorageDirectory = path.join(process.cwd(), "storage", "avatars");

function isNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export function createProfileAvatarFilename(extension: SupportedProfileAvatarExtension) {
  return `${randomUUID()}.${extension}`;
}

export function isProfileAvatarFilename(filename: string) {
  return profileAvatarFilenamePattern.test(filename);
}

export function getProfileAvatarUrl(filename: string) {
  if (!isProfileAvatarFilename(filename)) {
    return null;
  }

  return `${profileAvatarRoutePrefix}${filename}`;
}

export function getProfileAvatarFilenameFromUrl(url: string | null | undefined) {
  if (!url?.startsWith(profileAvatarRoutePrefix)) {
    return null;
  }

  const filename = url.slice(profileAvatarRoutePrefix.length);

  return isProfileAvatarFilename(filename) ? filename : null;
}

export function getProfileAvatarContentType(filename: string): ProfileAvatarContentType | null {
  if (!isProfileAvatarFilename(filename)) {
    return null;
  }

  const extension = filename.split(".").at(-1);
  const format = extension ? getProfileAvatarFormat(extension) : null;

  return format?.contentType ?? null;
}

export function getProfileAvatarStoragePath(filename: string) {
  if (!isProfileAvatarFilename(filename)) {
    return null;
  }

  return path.join(profileAvatarStorageDirectory, filename);
}

export async function writeProfileAvatarFile(filename: string, buffer: Buffer) {
  const filepath = getProfileAvatarStoragePath(filename);

  if (!filepath) {
    throw new Error("Invalid profile avatar filename");
  }

  await mkdir(profileAvatarStorageDirectory, { recursive: true });
  await writeFile(filepath, buffer);
}

export async function readProfileAvatarFile(filename: string) {
  const filepath = getProfileAvatarStoragePath(filename);

  if (!filepath) {
    return null;
  }

  try {
    return await readFile(filepath);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

export async function deleteProfileAvatarFile(filename: string) {
  const filepath = getProfileAvatarStoragePath(filename);

  if (!filepath) {
    return;
  }

  try {
    await unlink(filepath);
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
}

export async function deleteProfileAvatarFileByUrl(url: string | null | undefined) {
  const filename = getProfileAvatarFilenameFromUrl(url);

  if (filename) {
    await deleteProfileAvatarFile(filename);
  }
}
