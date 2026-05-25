import { afterEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

async function createTempRoot() {
  const root = await mkdtemp(join(tmpdir(), "gomoku-backup-test-"));
  tempRoots.push(root);
  return root;
}

function createEnv(overrides: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }

  return {
    ...env,
    ...overrides,
  };
}

async function runShellScript(scriptPath: string, env: Record<string, string>) {
  const child = Bun.spawn(["sh", scriptPath], {
    env,
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);

  return { exitCode, stderr, stdout };
}

async function installFakePostgresTools(binDir: string) {
  await writeFile(
    join(binDir, "pg_dump"),
    `#!/bin/sh
set -eu
output=""
for arg in "$@"; do
  case "$arg" in
    --file=*) output="\${arg#--file=}" ;;
  esac
done
if [ "$output" = "" ]; then
  echo "missing --file argument" >&2
  exit 64
fi
printf "custom postgres dump\\n" > "$output"
`,
  );
  await writeFile(
    join(binDir, "pg_restore"),
    `#!/bin/sh
set -eu
printf "%s\\n" "$@" > "$FAKE_SCRIPT_LOG_DIR/pg_restore.args"
`,
  );
  await chmod(join(binDir, "pg_dump"), 0o755);
  await chmod(join(binDir, "pg_restore"), 0o755);
}

describe("PostgreSQL backup and restore scripts", () => {
  test("creates a dump and checksum artifact that the restore script accepts", async () => {
    const root = await createTempRoot();
    const backupDir = join(root, "backups");
    const fakeBin = join(root, "bin");
    const logDir = join(root, "logs");
    await Promise.all([mkdirp(fakeBin), mkdirp(logDir)]);
    await installFakePostgresTools(fakeBin);

    const baseEnv = createEnv({
      FAKE_SCRIPT_LOG_DIR: logDir,
      PATH: `${fakeBin}:${process.env["PATH"] ?? ""}`,
      POSTGRES_BACKUP_DIR: backupDir,
      POSTGRES_BACKUP_RETENTION_DAYS: "7",
      POSTGRES_DB: "transcendence",
      POSTGRES_PASSWORD: "test-password",
    });

    const backupResult = await runShellScript("scripts/postgres-backup.sh", baseEnv);

    expect(backupResult.exitCode).toBe(0);
    expect(backupResult.stdout).toContain("Created PostgreSQL backup:");

    const artifacts = await readdir(backupDir);
    const dumpFile = artifacts.find((file) => file.endsWith(".dump"));

    expect(dumpFile).toBeDefined();
    expect(artifacts).toContain(`${dumpFile}.sha256`);

    const restoreResult = await runShellScript(
      "scripts/postgres-restore.sh",
      createEnv({
        ...baseEnv,
        BACKUP_FILE: join(backupDir, dumpFile!),
        CONFIRM_RESTORE: "restore",
      }),
    );

    expect(restoreResult.exitCode).toBe(0);
    expect(restoreResult.stdout).toContain(
      "Restored PostgreSQL backup into database:5432/transcendence",
    );

    const restoreArgs = await readFile(join(logDir, "pg_restore.args"), "utf8");

    expect(restoreArgs).toContain("--clean");
    expect(restoreArgs).toContain("--if-exists");
    expect(restoreArgs).toContain(join(backupDir, dumpFile!));
  });

  test("refuses destructive restore without explicit confirmation", async () => {
    const root = await createTempRoot();
    const fakeBin = join(root, "bin");
    const logDir = join(root, "logs");
    const backupFile = join(root, "transcendence.dump");
    await Promise.all([mkdirp(fakeBin), mkdirp(logDir)]);
    await installFakePostgresTools(fakeBin);
    await writeFile(backupFile, "custom postgres dump\n");

    const result = await runShellScript(
      "scripts/postgres-restore.sh",
      createEnv({
        BACKUP_FILE: backupFile,
        FAKE_SCRIPT_LOG_DIR: logDir,
        PATH: `${fakeBin}:${process.env["PATH"] ?? ""}`,
        POSTGRES_PASSWORD: "test-password",
      }),
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Set CONFIRM_RESTORE=restore");
    expect(await readdir(logDir)).not.toContain("pg_restore.args");
  });
});

async function mkdirp(path: string) {
  await rm(path, { force: true, recursive: true });
  await mkdir(path, { recursive: true });
}
