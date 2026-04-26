import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const withNextIntl = createNextIntlPlugin("./app/i18n/request.ts");

const nextConfig: NextConfig = {
  turbopack: {
    root: currentDirectory,
  },
  transpilePackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default withNextIntl(nextConfig);
