export const CSP_HEADER = "Content-Security-Policy";
export const CSP_NONCE_HEADER = "x-nonce";

const localRealtimeConnectSources = ["http://localhost:3001", "http://127.0.0.1:3001"];
const nextRouteAnnouncerStyleHashes = [
  "'sha256-/3kWSXHts8LrwfemLzY9W0tOv5I4eLIhrf0pT8cU0WI='",
  "'sha256-hCCaQPgMPt3yNJOfQ3ewN+1KFcGT2iwCHVykLMb9VvE='",
];
const nextImageStyleHashes = [
  "'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='",
  "'sha256-ZDrxqUOB4m/L0JWL/+gS52g1CRH0l/qwMhjTw5Z/Fsc='",
  "'sha256-fFiwGJFfGZ3i0Vt+xXYQgf88NKsgAfBwvY2aBowdoj4='",
];

type CspEnvironment = Partial<
  Record<"CI" | "NEXT_PUBLIC_SOCKET_URL" | "NODE_ENV" | "SOCKET_PUBLIC_URL", string | undefined>
>;

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return null;
  }
}

function getSocketConnectSources(env: CspEnvironment): string[] {
  const sources = new Set<string>();

  for (const key of ["SOCKET_PUBLIC_URL", "NEXT_PUBLIC_SOCKET_URL"] as const) {
    for (const entry of env[key]?.split(",") ?? []) {
      const origin = normalizeOrigin(entry);

      if (origin) {
        sources.add(origin);
      }
    }
  }

  if (env.CI === "true" || env.NODE_ENV !== "production") {
    for (const source of localRealtimeConnectSources) {
      sources.add(source);
    }
  }

  return Array.from(sources);
}

export function generateCspNonce(): string {
  const randomBytes = new Uint8Array(16);

  crypto.getRandomValues(randomBytes);

  return btoa(String.fromCharCode(...randomBytes));
}

export function createContentSecurityPolicy(
  nonce: string,
  env: CspEnvironment = process.env,
): string {
  const isDevelopment = env.NODE_ENV === "development";
  const isProduction = env.NODE_ENV === "production";
  const nonceSource = `'nonce-${nonce}'`;
  const scriptSources = [nonceSource, "'strict-dynamic'"];
  const styleSources = ["'self'", nonceSource];

  if (isDevelopment) {
    scriptSources.push("'unsafe-eval'");
    styleSources.push("'unsafe-inline'");
  }

  const directives = [
    ["default-src", "'self'"],
    ["base-uri", "'self'"],
    ["object-src", "'none'"],
    ["frame-ancestors", "'none'"],
    ["frame-src", "'none'"],
    ["form-action", "'self'"],
    ["img-src", "'self'", "data:", "blob:", "https:"],
    ["font-src", "'self'", "data:"],
    ["script-src", ...scriptSources],
    ["script-src-attr", "'none'"],
    ["style-src", ...styleSources],
    ["style-src-elem", ...styleSources],
    [
      "style-src-attr",
      "'unsafe-hashes'",
      ...nextRouteAnnouncerStyleHashes,
      ...nextImageStyleHashes,
    ],
    ["connect-src", "'self'", ...getSocketConnectSources(env), "ws:", "wss:"],
    ["manifest-src", "'self'"],
  ];

  if (isProduction) {
    directives.push(["upgrade-insecure-requests"]);
  }

  return directives.map((directive) => directive.join(" ")).join("; ");
}
