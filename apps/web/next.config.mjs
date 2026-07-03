import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add the names of your local packages here
  transpilePackages: ["@repo/ui", "@repo/utils"],
  // Configure Turbopack to avoid Windows junction point issues
  turbopack: {
    root: path.resolve(__dirname, "../../"),
    resolveAlias: {
      // Help Turbopack resolve the workspace root correctly
      "@": path.join(__dirname, "./"),
    },
  },
  // Allow network access for development (fix WebSocket HMR errors)
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.3"],
};

export default nextConfig;
