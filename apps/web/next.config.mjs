import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add the names of your local packages here
  transpilePackages: ["@repo/ui", "@repo/utils"],
  // Disable Turbopack on Windows to avoid junction point permission issues.
  // Next will fall back to webpack dev server.
  // Allow network access for development (fix WebSocket HMR errors)
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.3"],
};

export default nextConfig;
