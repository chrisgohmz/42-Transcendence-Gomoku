import { describe, expect, mock, test } from "bun:test";

await mock.module("server-only", () => ({}));

const { enforceJsonRequest, enforceSameOriginRequest } = await import("./request-security");

const trustedProductionEnv = {
  BETTER_AUTH_TRUSTED_ORIGINS: "https://app.example.test, https://www.example.test",
  NODE_ENV: "production",
} as NodeJS.ProcessEnv;

function request(headers: HeadersInit = {}) {
  return new Request("https://app.example.test/api/matches", {
    headers,
    method: "POST",
  });
}

describe("request security guards", () => {
  test("requires Origin for production mutation requests", async () => {
    const response = enforceSameOriginRequest(request(), trustedProductionEnv);

    expect(response?.status).toBe(403);
    expect(await response?.json()).toMatchObject({ error: "origin_required" });
  });

  test("allows missing Origin outside production for non-browser clients", () => {
    expect(
      enforceSameOriginRequest(request(), { NODE_ENV: "development" } as NodeJS.ProcessEnv),
    ).toBeNull();
  });

  test("allows configured trusted origins", () => {
    const response = enforceSameOriginRequest(
      request({ Origin: "https://app.example.test" }),
      trustedProductionEnv,
    );

    expect(response).toBeNull();
  });

  test("rejects malformed and untrusted origins", async () => {
    const malformed = enforceSameOriginRequest(
      request({ Origin: "not a url" }),
      trustedProductionEnv,
    );
    const untrusted = enforceSameOriginRequest(
      request({ Origin: "https://evil.example.test" }),
      trustedProductionEnv,
    );

    expect(malformed?.status).toBe(403);
    expect(await malformed?.json()).toMatchObject({ error: "invalid_origin" });
    expect(untrusted?.status).toBe(403);
    expect(await untrusted?.json()).toMatchObject({ error: "untrusted_origin" });
  });

  test("requires JSON media type when a route expects a JSON body", async () => {
    expect(enforceJsonRequest(request({ "Content-Type": "application/json" }))).toBeNull();
    expect(
      enforceJsonRequest(request({ "Content-Type": "application/json; charset=utf-8" })),
    ).toBeNull();

    const response = enforceJsonRequest(request({ "Content-Type": "text/plain" }));

    expect(response?.status).toBe(415);
    expect(await response?.json()).toMatchObject({ error: "unsupported_media_type" });
  });
});
