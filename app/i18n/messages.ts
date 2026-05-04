import type { Locale } from "./config";
import type { messages as enMessages } from "./messages/en";

export type Messages = typeof enMessages;

export const messageLoaders: Record<Locale, () => Promise<Messages>> = {
  en: () => import("./messages/en").then((module) => module.messages),
  ja: () => import("./messages/ja").then((module) => module.messages),
  zh: () => import("./messages/zh").then((module) => module.messages),
};
