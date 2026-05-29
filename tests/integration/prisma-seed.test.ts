import { expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyPassword } from "better-auth/crypto";
import pg from "pg";

import { getSoloMatchMetadata } from "../../app/lib/matches/ai-solo";
import { getChallengeMatchMetadata } from "../../app/lib/matches/challenge-metadata";

const { Client } = pg;

const shouldRunPrismaSeedSmoke =
  process.env["RUN_PRISMA_SEED_SMOKE"] === "true" ||
  Boolean(process.env["PRISMA_SEED_ADMIN_DATABASE_URL"]?.trim());
const prismaSeedSmokeTest = shouldRunPrismaSeedSmoke ? test : test.skip;
const currentDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDirectory, "../..");

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function getAdminDatabaseUrl(): string {
  const rawUrl =
    process.env["PRISMA_SEED_ADMIN_DATABASE_URL"]?.trim() ?? process.env["DATABASE_URL"]?.trim();

  if (!rawUrl) {
    throw new Error(
      "Set PRISMA_SEED_ADMIN_DATABASE_URL or DATABASE_URL to run the Prisma seed integration smoke test.",
    );
  }

  const url = new URL(rawUrl);
  url.pathname = `/${process.env["PRISMA_SEED_ADMIN_DATABASE"]?.trim() || "postgres"}`;
  url.search = "";
  return url.toString();
}

function getDatabaseUrlForName(databaseName: string): string {
  const rawUrl =
    process.env["PRISMA_SEED_ADMIN_DATABASE_URL"]?.trim() ?? process.env["DATABASE_URL"]?.trim();

  if (!rawUrl) {
    throw new Error("A database URL is required to build the temporary seed database URL.");
  }

  const url = new URL(rawUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

async function runCommand(command: string[], env: Record<string, string>) {
  const proc = Bun.spawn(command, {
    cwd: repoRoot,
    env: {
      ...process.env,
      ...env,
    },
    stderr: "pipe",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(
      [`Command failed (${exitCode}): ${command.join(" ")}`, stdout.trim(), stderr.trim()].join(
        "\n",
      ),
    );
  }

  return { stderr, stdout };
}

async function queryScalar<T>(client: InstanceType<typeof Client>, sql: string): Promise<T> {
  const result = await client.query(sql);
  return result.rows[0]?.["value"] as T;
}

async function countRows(client: InstanceType<typeof Client>, tableName: string): Promise<number> {
  const value = await queryScalar<string>(
    client,
    `SELECT COUNT(*)::int AS value FROM ${quoteIdentifier(tableName)}`,
  );
  return Number(value);
}

async function createTemporaryDatabase(
  adminClient: InstanceType<typeof Client>,
  databaseName: string,
) {
  await adminClient.query(`CREATE DATABASE ${quoteIdentifier(databaseName)}`);
}

async function dropTemporaryDatabase(
  adminClient: InstanceType<typeof Client>,
  databaseName: string,
) {
  await adminClient.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
    [databaseName],
  );
  await adminClient.query(`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)}`);
}

prismaSeedSmokeTest("seeds the evaluation dataset and preserves core invariants", async () => {
  const databaseName = `seed_test_${randomUUID().replaceAll("-", "_")}`;
  const adminClient = new Client({ connectionString: getAdminDatabaseUrl() });
  const databaseUrl = getDatabaseUrlForName(databaseName);

  await adminClient.connect();
  await createTemporaryDatabase(adminClient, databaseName);

  try {
    await runCommand(["bunx", "--bun", "prisma", "migrate", "deploy"], {
      DATABASE_URL: databaseUrl,
    });
    const firstSeed = await runCommand(["bun", "--bun", "prisma/seed.ts"], {
      DATABASE_URL: databaseUrl,
    });

    expect(firstSeed.stdout).toContain("15 users");
    expect(firstSeed.stdout).toContain("10 matches");

    const seededClient = new Client({ connectionString: databaseUrl });
    await seededClient.connect();

    try {
      expect(await countRows(seededClient, "User")).toBe(15);
      expect(await countRows(seededClient, "Friendship")).toBe(16);
      expect(await countRows(seededClient, "Conversation")).toBe(13);
      expect(await countRows(seededClient, "Match")).toBe(10);
      expect(await countRows(seededClient, "UserGameStats")).toBe(16);
      expect(await countRows(seededClient, "UserAchievement")).toBe(21);
      expect(await countRows(seededClient, "AnalyticsEvent")).toBe(12);
      expect(
        await queryScalar<number>(
          seededClient,
          `SELECT COUNT(*)::int AS value FROM "User" WHERE kind = 'HUMAN'`,
        ),
      ).toBe(13);
      expect(
        await queryScalar<number>(
          seededClient,
          `SELECT COUNT(*)::int AS value FROM "User" WHERE kind = 'BOT'`,
        ),
      ).toBe(2);
      expect(
        await queryScalar<number>(
          seededClient,
          `SELECT COUNT(*)::int AS value
             FROM "Account" account
             JOIN "User" app_user ON app_user.id = account."userId"
            WHERE app_user.kind = 'HUMAN'
              AND account."providerId" = 'credential'
              AND account.password IS NOT NULL
              AND account."accountId" = app_user.id`,
        ),
      ).toBe(13);
      expect(
        await queryScalar<number>(
          seededClient,
          `SELECT COUNT(*)::int AS value
             FROM "Account" account
             JOIN "User" app_user ON app_user.id = account."userId"
            WHERE app_user.kind = 'BOT'`,
        ),
      ).toBe(0);

      const credentialResult = await seededClient.query<{ password: string }>(
        `SELECT account.password
           FROM "Account" account
          JOIN "User" app_user ON app_user.id = account."userId"
          WHERE app_user.username = $1
            AND account."providerId" = 'credential'
            AND account.password IS NOT NULL`,
        ["alice"],
      );
      const alicePasswordHash = credentialResult.rows[0]?.password;

      expect(credentialResult.rows).toHaveLength(1);
      expect(alicePasswordHash).toEqual(expect.any(String));
      expect(alicePasswordHash).not.toBe("password123");

      if (!alicePasswordHash) {
        throw new Error("Seeded Alice credential account must include a password hash.");
      }

      expect(await verifyPassword({ hash: alicePasswordHash, password: "password123" })).toBe(true);

      expect(
        await queryScalar<number>(
          seededClient,
          'SELECT COUNT(*)::int AS value FROM "UserGameStats" WHERE "currentStreak" < 0',
        ),
      ).toBe(0);
      expect(
        await queryScalar<number>(
          seededClient,
          `SELECT COUNT(*)::int AS value
             FROM "MatchParticipant" participant
             JOIN "Match" seeded_match ON seeded_match.id = participant."matchId"
            WHERE seeded_match.status = 'FINISHED'
              AND participant.role = 'SPECTATOR'
              AND participant.result IS NOT NULL`,
        ),
      ).toBe(0);
      expect(
        await queryScalar<number>(
          seededClient,
          `SELECT COUNT(*)::int AS value
             FROM "MatchParticipant" participant
             JOIN "Match" seeded_match ON seeded_match.id = participant."matchId"
            WHERE seeded_match.status = 'FINISHED'
              AND participant.role = 'PLAYER'
              AND participant.seat IN ('BLACK', 'WHITE')
              AND (
                participant.result IS NULL
                OR participant.result NOT IN ('WIN', 'LOSS', 'DRAW')
              )`,
        ),
      ).toBe(0);
      expect(
        await queryScalar<number>(
          seededClient,
          `SELECT COUNT(*)::int AS value FROM "User" WHERE "avatarUrl" IS NOT NULL AND "avatarUrl" !~ '^/seed-avatars/[^/]+\\.svg$'`,
        ),
      ).toBe(0);
      expect(
        await queryScalar<number>(
          seededClient,
          `SELECT COUNT(*)::int AS value FROM "AvatarMedia" WHERE url !~ '^/seed-avatars/[^/]+\\.svg$' OR provider <> 'seed-local'`,
        ),
      ).toBe(0);

      const avatarResult = await seededClient.query<{ avatarUrl: string }>(
        'SELECT "avatarUrl" FROM "User" WHERE "avatarUrl" IS NOT NULL ORDER BY username',
      );

      for (const row of avatarResult.rows) {
        expect(existsSync(join(repoRoot, "public", row.avatarUrl.slice(1)))).toBe(true);
      }

      const metadataResult = await seededClient.query<{
        metadata: unknown;
        name: string;
      }>('SELECT name, metadata FROM "Match" WHERE metadata IS NOT NULL ORDER BY name');
      const challenge = metadataResult.rows.find((row) => row.name === "alice vs Tenkei");
      const solo = metadataResult.rows.find(
        (row) => row.name === "Solo Focus: Alice vs Kata Reader",
      );

      expect(getChallengeMatchMetadata(challenge?.metadata)).toMatchObject({
        kind: "human-challenge",
        targetUsername: "Tenkei",
      });
      expect(getSoloMatchMetadata(solo?.metadata)).toEqual({
        aiDifficulty: "expert",
        mode: "ai",
      });

      const secondSeed = await runCommand(["bun", "--bun", "prisma/seed.ts"], {
        DATABASE_URL: databaseUrl,
      });

      expect(secondSeed.stdout).toContain("Database is not empty; skipping seed");
      expect(await countRows(seededClient, "User")).toBe(15);
    } finally {
      await seededClient.end();
    }
  } finally {
    await dropTemporaryDatabase(adminClient, databaseName).finally(async () => {
      await adminClient.end();
    });
  }
});
