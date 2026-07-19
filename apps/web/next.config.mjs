import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, "../.."),
  turbopack: {
    root: path.resolve(__dirname, "../.."),
    resolveExtensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  // Add the names of your local packages here
  transpilePackages: ["@repo/ui", "@repo/utils", "@atlas/shared"],
  // Allow network access for development (fix WebSocket HMR errors)
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.3"],
};

export default nextConfig;
