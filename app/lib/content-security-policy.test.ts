import { describe, expect, test } from "bun:test";

import {
  createContentSecurityPolicy,
  CSP_HEADER,
  CSP_NONCE_HEADER,
  generateCspNonce,
} from "./content-security-policy";

function directiveSources(policy: string, directiveName: string): string[] {
  const directive = policy.split("; ").find((entry) => entry.startsWith(`${directiveName} `));

  return directive?.split(" ").slice(1) ?? [];
}

describe("content security policy", () => {
  test("builds a production nonce policy without inline script or dynamic eval escapes", () => {
    const policy = createContentSecurityPolicy("test-nonce", {
      BETTER_AUTH_URL: "https://app.example.test",
      NODE_ENV: "production",
      SOCKET_PUBLIC_URL: "https://socket.example.test/realtime",
    });
    const connectSources = directiveSources(policy, "connect-src");

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("script-src 'nonce-test-nonce' 'strict-dynamic'");
    expect(policy).toContain("script-src-attr 'none'");
    expect(policy).toContain("style-src 'self' 'nonce-test-nonce'");
    expect(policy).toContain("style-src-elem 'self' 'nonce-test-nonce'");
    expect(policy).toContain("'sha256-Wwucq8eX2r0YFymkQhDXm5hN0+FfSvI3s4JSSaqa4iw='");
    expect(policy).toContain("style-src-attr 'unsafe-hashes'");
    expect(policy).toContain("'sha256-/3kWSXHts8LrwfemLzY9W0tOv5I4eLIhrf0pT8cU0WI='");
    expect(policy).toContain("'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='");
    expect(policy).toContain("'sha256-ZDrxqUOB4m/L0JWL/+gS52g1CRH0l/qwMhjTw5Z/Fsc='");
    expect(policy).toContain("'sha256-fFiwGJFfGZ3i0Vt+xXYQgf88NKsgAfBwvY2aBowdoj4='");
    expect(connectSources).toContain("'self'");
    expect(connectSources).toContain("https://app.example.test");
    expect(connectSources).toContain("wss://app.example.test");
    expect(connectSources).toContain("https://socket.example.test");
    expect(connectSources).toContain("wss://socket.example.test");
    expect(connectSources).not.toContain("ws:");
    expect(connectSources).not.toContain("wss:");
    expect(connectSources).not.toContain("http://localhost:3001");
    expect(connectSources).not.toContain("ws://localhost:3001");
    expect(policy).toContain("upgrade-insecure-requests");
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  test("keeps development eval and local websocket allowances out of production", () => {
    const policy = createContentSecurityPolicy("test-nonce", {
      NODE_ENV: "development",
    });
    const styleElementSources = directiveSources(policy, "style-src-elem");

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain("'unsafe-inline'");
    expect(styleElementSources).toContain("'unsafe-inline'");
    expect(styleElementSources).not.toContain("'nonce-test-nonce'");
    expect(styleElementSources).not.toContain(
      "'sha256-Wwucq8eX2r0YFymkQhDXm5hN0+FfSvI3s4JSSaqa4iw='",
    );
    expect(policy).toContain("http://localhost:3001");
    expect(policy).toContain("ws://localhost:3001");
    expect(policy).toContain("http://127.0.0.1:3001");
    expect(policy).toContain("ws://127.0.0.1:3001");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  test("derives exact connect sources from comma-separated deployment origins", () => {
    const policy = createContentSecurityPolicy("test-nonce", {
      BETTER_AUTH_TRUSTED_ORIGINS: "https://app.example.test, https://lan.example.test:8443",
      NODE_ENV: "production",
      SOCKET_PUBLIC_URL: "wss://socket.example.test/socket.io",
    });
    const connectSources = directiveSources(policy, "connect-src");

    expect(connectSources).toContain("https://app.example.test");
    expect(connectSources).toContain("wss://app.example.test");
    expect(connectSources).toContain("https://lan.example.test:8443");
    expect(connectSources).toContain("wss://lan.example.test:8443");
    expect(connectSources).toContain("wss://socket.example.test");
    expect(connectSources).not.toContain("ws:");
    expect(connectSources).not.toContain("wss:");
  });

  test("generates unique base64 nonces for proxy responses", () => {
    const firstNonce = generateCspNonce();
    const secondNonce = generateCspNonce();

    expect(firstNonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(secondNonce).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(firstNonce).not.toBe(secondNonce);
  });

  test("exports the header names used by proxy and rendering", () => {
    expect(CSP_HEADER).toBe("Content-Security-Policy");
    expect(CSP_NONCE_HEADER).toBe("x-nonce");
  });
});
