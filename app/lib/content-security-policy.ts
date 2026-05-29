export const CSP_HEADER = "Content-Security-Policy";
export const CSP_NONCE_HEADER = "x-nonce";

const localRealtimeConnectSources = ["http://localhost:3001", "http://127.0.0.1:3001"];
const appOriginEnvKeys = [
  "BETTER_AUTH_URL",
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "CADDY_SITE_ADDRESS",
  "NEXT_PUBLIC_APP_URL",
  "SOCKET_CORS_ORIGIN",
] as const;
const socketOriginEnvKeys = ["SOCKET_PUBLIC_URL", "NEXT_PUBLIC_SOCKET_URL"] as const;
const nextRouteAnnouncerStyleHashes = [
  "'sha256-/3kWSXHts8LrwfemLzY9W0tOv5I4eLIhrf0pT8cU0WI='",
  "'sha256-hCCaQPgMPt3yNJOfQ3ewN+1KFcGT2iwCHVykLMb9VvE='",
];
const nextImageStyleHashes = [
  "'sha256-zlqnbDt84zf1iSefLU/ImC54isoprH/MRiVZGskwexk='",
  "'sha256-ZDrxqUOB4m/L0JWL/+gS52g1CRH0l/qwMhjTw5Z/Fsc='",
  "'sha256-fFiwGJFfGZ3i0Vt+xXYQgf88NKsgAfBwvY2aBowdoj4='",
];
const nextStyleElementHashes = ["'sha256-Wwucq8eX2r0YFymkQhDXm5hN0+FfSvI3s4JSSaqa4iw='"];

type CspEnvironment = Partial<
  Record<
    | "BETTER_AUTH_TRUSTED_ORIGINS"
    | "BETTER_AUTH_URL"
    | "CADDY_SITE_ADDRESS"
    | "CI"
    | "NEXT_PUBLIC_APP_URL"
    | "NEXT_PUBLIC_SOCKET_URL"
    | "NODE_ENV"
    | "SOCKET_CORS_ORIGIN"
    | "SOCKET_PUBLIC_URL",
    string | undefined
  >
>;

function getUrl(value: string): URL | null {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
}

function addConnectSource(sources: Set<string>, value: string) {
  const url = getUrl(value);

  if (!url) {
    return;
  }

  sources.add(url.origin);

  if (url.protocol === "http:") {
    sources.add(`ws://${url.host}`);
  }

  if (url.protocol === "https:") {
    sources.add(`wss://${url.host}`);
  }
}

function addEnvConnectSources(
  sources: Set<string>,
  env: CspEnvironment,
  keys: ReadonlyArray<keyof CspEnvironment>,
) {
  for (const key of keys) {
    for (const entry of env[key]?.split(",") ?? []) {
      addConnectSource(sources, entry);
    }
  }
}

function getSocketConnectSources(env: CspEnvironment): string[] {
  const sources = new Set<string>();

  addEnvConnectSources(sources, env, appOriginEnvKeys);
  addEnvConnectSources(sources, env, socketOriginEnvKeys);

  if (env.CI === "true" || env.NODE_ENV !== "production") {
    for (const source of localRealtimeConnectSources) {
      addConnectSource(sources, source);
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
  const styleSources = isDevelopment ? ["'self'", "'unsafe-inline'"] : ["'self'", nonceSource];
  const styleElementSources = isDevelopment
    ? styleSources
    : [...styleSources, ...nextStyleElementHashes];

  if (isDevelopment) {
    scriptSources.push("'unsafe-eval'");
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
    ["style-src-elem", ...styleElementSources],
    [
      "style-src-attr",
      "'unsafe-hashes'",
      ...nextRouteAnnouncerStyleHashes,
      ...nextImageStyleHashes,
    ],
    ["connect-src", "'self'", ...getSocketConnectSources(env)],
    ["manifest-src", "'self'"],
  ];

  if (isProduction) {
    directives.push(["upgrade-insecure-requests"]);
  }

  return directives.map((directive) => directive.join(" ")).join("; ");
}
