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

async function installFakeDocker(binDir: string) {
  await writeFile(
    join(binDir, "docker"),
    `#!/bin/sh
set -eu

log="$FAKE_SCRIPT_LOG_DIR/docker.commands"
printf "%s\\n" "$*" >> "$log"

command="\${1:-}"
subcommand="\${2:-}"
joined="$*"

case "$command" in
  volume)
    case "$subcommand" in
      inspect)
        if [ "\${FAKE_DOCKER_VOLUME_MISSING:-}" = "true" ]; then
          exit 1
        fi
        exit 0
        ;;
      create)
        echo "\${3:-fake-volume}"
        exit 0
        ;;
      rm)
        exit 0
        ;;
    esac
    ;;
  network)
    case "$subcommand" in
      create)
        echo "\${3:-fake-network}"
        exit 0
        ;;
      rm)
        exit 0
        ;;
    esac
    ;;
  rm)
    exit 0
    ;;
  logs)
    echo "fake docker logs" >&2
    exit 0
    ;;
  run)
    case "$joined" in
      *"ls -1t /backups/*.dump"*)
        echo "/backups/transcendence-20260525T000000Z.dump"
        exit 0
        ;;
      *"sh /usr/local/bin/postgres-restore"*)
        exit 0
        ;;
      *"--detach"*)
        echo "fake-container"
        exit 0
        ;;
    esac
    exit 0
    ;;
  exec)
    case "\${3:-}" in
      pg_isready)
        if [ "\${FAKE_DOCKER_NEVER_READY:-}" = "true" ]; then
          exit 1
        fi
        exit 0
        ;;
      psql)
        echo "12"
        exit 0
        ;;
    esac
    exit 0
    ;;
esac

echo "unsupported docker command: $*" >&2
exit 64
`,
  );
  await writeFile(
    join(binDir, "sleep"),
    `#!/bin/sh
exit 0
`,
  );
  await chmod(join(binDir, "docker"), 0o755);
  await chmod(join(binDir, "sleep"), 0o755);
}

describe("PostgreSQL backup and restore scripts", () => {
  test("backup loop runs a mounted backup script through sh", async () => {
    const root = await createTempRoot();
    const logDir = join(root, "logs");
    const backupScript = join(root, "postgres-backup");
    await mkdirp(logDir);
    await writeFile(
      backupScript,
      `#!/bin/sh
set -eu
printf "ran\\n" > "$FAKE_SCRIPT_LOG_DIR/backup-ran"
exit 42
`,
    );

    const result = await runShellScript(
      "scripts/postgres-backup-loop.sh",
      createEnv({
        FAKE_SCRIPT_LOG_DIR: logDir,
        POSTGRES_BACKUP_DISABLED: "false",
        POSTGRES_BACKUP_INTERVAL_SECONDS: "1",
        POSTGRES_BACKUP_SCRIPT: backupScript,
      }),
    );

    expect(result.exitCode).toBe(42);
    expect(await readFile(join(logDir, "backup-ran"), "utf8")).toBe("ran\n");
  });

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

  test("runs the restore drill against the latest backup artifact", async () => {
    const root = await createTempRoot();
    const fakeBin = join(root, "bin");
    const logDir = join(root, "logs");
    await Promise.all([mkdirp(fakeBin), mkdirp(logDir)]);
    await installFakeDocker(fakeBin);

    const result = await runShellScript(
      "scripts/postgres-restore-drill.sh",
      createEnv({
        COMPOSE_PROJECT_NAME: "gomoku",
        FAKE_SCRIPT_LOG_DIR: logDir,
        PATH: `${fakeBin}:${process.env["PATH"] ?? ""}`,
        RESTORE_DRILL_READY_TIMEOUT_SECONDS: "3",
      }),
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Restore drill completed successfully.");
    expect(result.stdout).toContain(
      "Backup artifact: /backups/transcendence-20260525T000000Z.dump",
    );
    expect(result.stdout).toContain("Restored public table count: 12");

    const dockerCommands = await readFile(join(logDir, "docker.commands"), "utf8");

    expect(dockerCommands).toContain("volume inspect gomoku_postgres_backups");
    expect(dockerCommands).toContain("network create gomoku_restore_drill_");
    expect(dockerCommands).toContain("volume create gomoku_restore_drill_data_");
    expect(dockerCommands).toContain("exec gomoku_restore_drill_db_");
    expect(dockerCommands).toContain("sh /usr/local/bin/postgres-restore");
  });

  test("fails the restore drill when the temporary database never becomes ready", async () => {
    const root = await createTempRoot();
    const fakeBin = join(root, "bin");
    const logDir = join(root, "logs");
    await Promise.all([mkdirp(fakeBin), mkdirp(logDir)]);
    await installFakeDocker(fakeBin);

    const result = await runShellScript(
      "scripts/postgres-restore-drill.sh",
      createEnv({
        BACKUP_FILE: "/backups/transcendence-20260525T000000Z.dump",
        COMPOSE_PROJECT_NAME: "gomoku",
        FAKE_DOCKER_NEVER_READY: "true",
        FAKE_SCRIPT_LOG_DIR: logDir,
        PATH: `${fakeBin}:${process.env["PATH"] ?? ""}`,
        RESTORE_DRILL_READY_TIMEOUT_SECONDS: "1",
      }),
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Restore drill database did not become ready within 1s.");

    const dockerCommands = await readFile(join(logDir, "docker.commands"), "utf8");

    expect(dockerCommands).toContain("logs gomoku_restore_drill_db_");
  });
});

async function mkdirp(path: string) {
  await rm(path, { force: true, recursive: true });
  await mkdir(path, { recursive: true });
}
