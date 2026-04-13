import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  compress: process.env["NODE_ENV"] === "production",
  turbopack: {
    root: currentDirectory,
  },
};

export default nextConfig;
