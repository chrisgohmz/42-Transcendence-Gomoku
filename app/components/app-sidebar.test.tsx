import { describe, expect, test } from "bun:test";

const fixturePath = "tests/fixtures/app-sidebar-session-avatar.fixture.tsx";

describe("AppSidebar", () => {
  test("uses the full current session avatar for desktop and mobile profile links", async () => {
    const child = Bun.spawn([process.execPath, fixturePath], {
      cwd: `${import.meta.dir}/../..`,
      env: {
        ...process.env,
        NO_COLOR: "1",
      },
      stderr: "pipe",
      stdout: "pipe",
    });

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);

    if (exitCode !== 0) {
      throw new Error(formatFixtureFailure(stdout, stderr));
    }

    expect(exitCode).toBe(0);
  });
});

function formatFixtureFailure(stdout: string, stderr: string) {
  const output = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
  return output || `${fixturePath} exited without diagnostic output`;
}
