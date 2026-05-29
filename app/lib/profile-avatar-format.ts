export const profileAvatarFormats = {
  jpg: { contentType: "image/jpeg" },
  png: { contentType: "image/png" },
  webp: { contentType: "image/webp" },
} as const;

export type SupportedProfileAvatarExtension = keyof typeof profileAvatarFormats;
export type ProfileAvatarContentType =
  (typeof profileAvatarFormats)[SupportedProfileAvatarExtension]["contentType"];

export const supportedProfileAvatarExtensions = Object.keys(
  profileAvatarFormats,
) as SupportedProfileAvatarExtension[];

export function isProfileAvatarExtension(
  extension: string,
): extension is SupportedProfileAvatarExtension {
  return Object.hasOwn(profileAvatarFormats, extension);
}

export function getProfileAvatarFormat(extension: string) {
  return isProfileAvatarExtension(extension) ? profileAvatarFormats[extension] : null;
}
