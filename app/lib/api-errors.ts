import "server-only";
import type { Prisma } from "../../generated/prisma/client";

export type ApiFieldErrors = Record<string, string[]>;

export type ApiErrorPayload = {
  detail?: string;
  error: string;
  fields?: ApiFieldErrors;
  message: string;
};

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export function apiErrorResponse(payload: ApiErrorPayload, status: number): Response {
  return Response.json(payload, { status });
}

export function getPrismaUniqueConstraintFields(
  error: Prisma.PrismaClientKnownRequestError,
): string[] {
  const target = error.meta?.["target"];

  if (Array.isArray(target)) {
    return target.filter((field): field is string => typeof field === "string");
  }

  return typeof target === "string" ? [target] : [];
}

export function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
