-- Move legacy OAuth provider records into Better Auth's Account table before
-- dropping the old app-owned auth table.
INSERT INTO "Account" (
    "id",
    "accountId",
    "providerId",
    "userId",
    "accessToken",
    "refreshToken",
    "accessTokenExpiresAt",
    "scope",
    "createdAt",
    "updatedAt"
)
SELECT
    "OAuthAccount"."id",
    "OAuthAccount"."providerAccountId",
    lower("OAuthAccount"."provider"::text),
    "OAuthAccount"."userId",
    "OAuthAccount"."accessToken",
    "OAuthAccount"."refreshToken",
    "OAuthAccount"."expiresAt",
    "OAuthAccount"."scopes",
    "OAuthAccount"."createdAt",
    "OAuthAccount"."createdAt"
FROM "OAuthAccount"
WHERE EXISTS (
    SELECT 1 FROM "User" WHERE "User"."id" = "OAuthAccount"."userId"
)
ON CONFLICT DO NOTHING;

-- Better Auth owns email verification as a boolean on User.
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerifiedAt";

-- Better Auth does not use this legacy app-owned session revocation column.
ALTER TABLE "UserSession" DROP COLUMN IF EXISTS "revokedAt";

DROP TABLE IF EXISTS "OAuthAccount";
DROP TYPE IF EXISTS "OAuthProvider";
