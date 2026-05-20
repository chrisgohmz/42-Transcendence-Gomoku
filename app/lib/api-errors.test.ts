import { describe, expect, mock, test } from "bun:test";

import type { Prisma } from "../../generated/prisma/client";

await mock.module("server-only", () => ({}));

const {
  apiErrorResponse,
  getErrorMessage,
  getPrismaUniqueConstraintFields,
  isPrismaUniqueConstraintError,
} = await import("./api-errors");

describe("api error helpers", () => {
  test("maps unknown errors to a stable public message", () => {
    expect(getErrorMessage(new Error("database unavailable"))).toBe("database unavailable");
    expect(getErrorMessage("boom")).toBe("Unknown error");
    expect(getErrorMessage(null)).toBe("Unknown error");
  });

  test("returns structured JSON error responses with the requested status", async () => {
    const response = apiErrorResponse(
      {
        detail: "email is malformed",
        error: "validation_failed",
        fields: { email: ["Email is invalid"] },
        message: "Please fix the highlighted fields.",
      },
      400,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      detail: "email is malformed",
      error: "validation_failed",
      fields: { email: ["Email is invalid"] },
      message: "Please fix the highlighted fields.",
    });
  });

  test("extracts Prisma unique constraint fields from string and array metadata", () => {
    expect(getPrismaUniqueConstraintFields(prismaError({ target: "email" }))).toEqual(["email"]);
    expect(
      getPrismaUniqueConstraintFields(prismaError({ target: ["email", 42, "username"] })),
    ).toEqual(["email", "username"]);
    expect(getPrismaUniqueConstraintFields(prismaError({ target: null }))).toEqual([]);
  });

  test("detects Prisma unique constraint errors by code without trusting the prototype", () => {
    expect(isPrismaUniqueConstraintError(prismaError({ target: "email" }))).toBe(true);
    expect(isPrismaUniqueConstraintError({ code: "P2003" })).toBe(false);
    expect(isPrismaUniqueConstraintError(null)).toBe(false);
  });
});

function prismaError(meta: Record<string, unknown>): Prisma.PrismaClientKnownRequestError {
  return {
    code: "P2002",
    meta,
  } as Prisma.PrismaClientKnownRequestError;
}
