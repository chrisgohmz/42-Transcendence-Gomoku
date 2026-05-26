import "server-only";
import type { RateLimitRule } from "./rate-limit";

type RateLimitRuleDefinition = Omit<RateLimitRule, "subject">;

export const rateLimitRules = {
  authActionLogin: { key: "auth-action:login", max: 10, windowSeconds: 60 },
  authActionPasswordResetConfirm: {
    key: "auth-action:password-reset-confirm",
    max: 10,
    windowSeconds: 60,
  },
  authActionPasswordResetRequest: {
    key: "auth-action:password-reset-request",
    max: 3,
    windowSeconds: 60,
  },
  authActionSignup: { key: "auth-action:signup", max: 5, windowSeconds: 60 },
  authLogin: { key: "auth:login", max: 10, windowSeconds: 60 },
  authLogout: { key: "auth:logout", max: 30, windowSeconds: 60 },
  authSignup: { key: "auth:signup", max: 5, windowSeconds: 60 },
  conversationDirect: { key: "conversations:direct", max: 30, windowSeconds: 60 },
  conversationMessage: { key: "conversations:message", max: 60, windowSeconds: 60 },
  conversationRead: { key: "conversations:read", max: 120, windowSeconds: 60 },
  friendsRemove: { key: "friends:remove", max: 30, windowSeconds: 60 },
  friendsRespond: { key: "friends:respond", max: 30, windowSeconds: 60 },
  friendsSend: { key: "friends:send", max: 30, windowSeconds: 60 },
  matchAiTurn: { key: "matches:ai-turn", max: 60, windowSeconds: 60 },
  matchCancel: { key: "matches:cancel", max: 30, windowSeconds: 60 },
  matchChallengeCreate: { key: "matches:challenge", max: 20, windowSeconds: 60 },
  matchChallengeDecline: {
    key: "matches:challenge:decline",
    max: 30,
    windowSeconds: 60,
  },
  matchCreate: { key: "matches:create", max: 20, windowSeconds: 60 },
  matchJoin: { key: "matches:join", max: 30, windowSeconds: 60 },
  matchMove: { key: "matches:move", max: 120, windowSeconds: 60 },
  matchQueueCancel: { key: "matches:queue:cancel", max: 30, windowSeconds: 60 },
  matchQueueJoin: { key: "matches:queue:join", max: 30, windowSeconds: 60 },
  matchResign: { key: "matches:resign", max: 30, windowSeconds: 60 },
  matchSolo: { key: "matches:solo", max: 20, windowSeconds: 60 },
  profileAvatarUpload: { key: "profile:avatar-upload", max: 10, windowSeconds: 3600 },
  profileChangePassword: { key: "profile:change-password", max: 20, windowSeconds: 60 },
  profileDisplayName: { key: "profile:display-name", max: 20, windowSeconds: 60 },
  profileFriendAction: { key: "profile:friend-action", max: 30, windowSeconds: 60 },
  profileSetPassword: { key: "profile:set-password", max: 20, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRuleDefinition>;

export type RateLimitRuleName = keyof typeof rateLimitRules;

export function rateLimitRule(name: RateLimitRuleName, subject?: string | null): RateLimitRule {
  const rule = rateLimitRules[name];

  return subject === undefined ? { ...rule } : { ...rule, subject };
}

export function userRateLimitSubject(userId: string) {
  return `user:${userId}`;
}
