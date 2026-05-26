import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const apiDir = path.join(process.cwd(), "app", "api");

async function getRouteFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return getRouteFiles(entryPath);
      }

      return entry.name === "route.ts" ? [entryPath] : [];
    }),
  );

  return files.flat();
}

describe("API mutation security coverage", () => {
  test("all mutating route handlers enforce the shared mutation request guard", async () => {
    const routeFiles = await getRouteFiles(apiDir);
    const missingGuard: string[] = [];

    for (const routeFile of routeFiles) {
      const source = await readFile(routeFile, "utf8");
      const hasMutationHandler = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/.test(
        source,
      );

      if (hasMutationHandler && !source.includes("enforceMutationRequest(")) {
        missingGuard.push(path.relative(process.cwd(), routeFile));
      }
    }

    expect(missingGuard).toEqual([]);
  });
});
