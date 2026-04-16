import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: currentDirectory,
  },
  transpilePackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default nextConfig;
