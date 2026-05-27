import { describe, expect, test } from "bun:test";

import { NextRequest } from "next/server";

import { CSP_HEADER, CSP_NONCE_HEADER } from "./app/lib/content-security-policy";
import { proxy } from "./proxy";

describe("proxy CSP", () => {
  test("adds a fresh CSP nonce to the response and forwarded request headers", () => {
    const response = proxy(new NextRequest("https://app.example.test/en/login"));
    const policy = response.headers.get(CSP_HEADER);
    const nonce = policy?.match(/'nonce-([^']+)'/)?.[1];

    if (!policy || !nonce) {
      throw new Error("Expected proxy to create a nonce-bearing CSP header");
    }

    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).toContain("script-src 'self' 'nonce-");
    expect(policy).toContain("style-src 'self' 'nonce-");
    expect(response.headers.get(`x-middleware-request-${CSP_NONCE_HEADER}`)).toBe(nonce);
    expect(response.headers.get(`x-middleware-request-${CSP_HEADER.toLowerCase()}`)).toBe(policy);
  });
});
