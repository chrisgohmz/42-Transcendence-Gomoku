import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin("./app/i18n/request.ts");
const devOriginEnvKeys = [
  "BETTER_AUTH_TRUSTED_ORIGINS",
  "CADDY_SITE_ADDRESS",
  "BETTER_AUTH_URL",
  "SOCKET_CORS_ORIGIN",
];
const devHostEnvKeys = ["CADDY_DEFAULT_SNI"];

function getHostname(value: string): string | null {
  const trimmed = value.trim().replace(/^['"]|['"]$/g, "");

  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    try {
      return new URL(`https://${trimmed}`).hostname.toLowerCase();
    } catch {
      return null;
    }
  }
}

function getAllowedDevOrigins(): string[] {
  const hostnames = new Set<string>();

  for (const key of devOriginEnvKeys) {
    for (const entry of process.env[key]?.split(",") ?? []) {
      const hostname = getHostname(entry);

      if (hostname) {
        hostnames.add(hostname);
      }
    }
  }

  for (const key of devHostEnvKeys) {
    const hostname = getHostname(process.env[key] ?? "");

    if (hostname) {
      hostnames.add(hostname);
    }
  }

  return Array.from(hostnames);
}

const allowedDevOrigins = getAllowedDevOrigins();

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedDevOrigins.length > 0 ? allowedDevOrigins : undefined,
  cacheComponents: true,
  experimental: {
    instantNavigationDevToolsToggle: true,
  },
  turbopack: {
    root: currentDirectory,
  },
  transpilePackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default withNextIntl(nextConfig);
