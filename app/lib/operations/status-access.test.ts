import { describe, expect, test } from "bun:test";

import {
  canViewOperationsStatus,
  hasValidOperationsStatusToken,
  operationsStatusTokenHeader,
} from "./status-access";

const operatorSession = {
  session: { id: "session-1" },
  user: {
    id: "user-1",
    username: "operator",
  },
};

function testEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
  };

  for (const [key, value] of Object.entries(overrides)) {
    env[key] = value;
  }

  return env;
}

describe("operations status access", () => {
  test("allows a matching internal monitoring token", () => {
    const request = new Request("http://localhost/api/status", {
      headers: {
        [operationsStatusTokenHeader]: "monitor-token",
      },
    });

    expect(
      hasValidOperationsStatusToken(
        request,
        testEnv({
          OPERATIONS_STATUS_TOKEN: "monitor-token",
        }),
      ),
    ).toBe(true);
  });

  test("rejects missing and mismatched internal monitoring tokens", () => {
    expect(
      hasValidOperationsStatusToken(
        undefined,
        testEnv({
          OPERATIONS_STATUS_TOKEN: "monitor-token",
        }),
      ),
    ).toBe(false);

    expect(
      hasValidOperationsStatusToken(
        new Request("http://localhost/api/status"),
        testEnv({
          OPERATIONS_STATUS_TOKEN: "monitor-token",
        }),
      ),
    ).toBe(false);

    expect(
      hasValidOperationsStatusToken(
        new Request("http://localhost/api/status", {
          headers: {
            [operationsStatusTokenHeader]: "wrong-token",
          },
        }),
        testEnv({
          OPERATIONS_STATUS_TOKEN: "monitor-token",
        }),
      ),
    ).toBe(false);
  });

  test("allows signed-in operators by explicit user id or username", () => {
    expect(
      canViewOperationsStatus(
        operatorSession,
        testEnv({
          OPERATIONS_STATUS_USER_IDS: "user-0, user-1",
        }),
      ),
    ).toBe(true);

    expect(
      canViewOperationsStatus(
        operatorSession,
        testEnv({
          OPERATIONS_STATUS_USERNAMES: "admin, operator",
        }),
      ),
    ).toBe(true);
  });

  test("rejects normal signed-in users when no operations allowlist matches", () => {
    expect(canViewOperationsStatus(operatorSession, testEnv())).toBe(false);
    expect(
      canViewOperationsStatus(
        operatorSession,
        testEnv({
          OPERATIONS_STATUS_USER_IDS: "other-user",
          OPERATIONS_STATUS_USERNAMES: "other-operator",
        }),
      ),
    ).toBe(false);
  });
});
