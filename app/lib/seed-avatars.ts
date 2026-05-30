export const seedProfileAvatars = [
  { name: "Alice", url: "/seed-avatars/alice.svg" },
  { name: "Bob", url: "/seed-avatars/bob.svg" },
  { name: "Carol", url: "/seed-avatars/carol.svg" },
  { name: "Hoshi", url: "/seed-avatars/hoshi.svg" },
  { name: "Renju Master", url: "/seed-avatars/renju-master.svg" },
  { name: "Kuroishi", url: "/seed-avatars/kuroishi.svg" },
  { name: "Shirotora", url: "/seed-avatars/shirotora.svg" },
  { name: "Tenkei", url: "/seed-avatars/tenkei.svg" },
  { name: "Mei", url: "/seed-avatars/mei.svg" },
  { name: "Lina", url: "/seed-avatars/lina.svg" },
  { name: "Arun", url: "/seed-avatars/arun.svg" },
  { name: "Mika", url: "/seed-avatars/mika.svg" },
  { name: "Kata Reader", url: "/seed-avatars/kata-reader.svg" },
  { name: "Ladder Bot", url: "/seed-avatars/ladder-bot.svg" },
] as const;

export type SeedProfileAvatarUrl = (typeof seedProfileAvatars)[number]["url"];

const seedProfileAvatarUrls = new Set<string>(seedProfileAvatars.map((avatar) => avatar.url));

export function isSeedProfileAvatarUrl(
  value: string | null | undefined,
): value is SeedProfileAvatarUrl {
  return typeof value === "string" && seedProfileAvatarUrls.has(value);
}
