import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add the names of your local packages here
  transpilePackages: ["@repo/ui", "@repo/utils"],
  // Pin the workspace root so Next.js doesn't pick up a stray
  // package-lock.json in a parent directory (e.g. C:\Users\<user>).
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  // Allow network access for development (fix WebSocket HMR errors)
  allowedDevOrigins: ["localhost", "127.0.0.1", "192.168.1.3"],
};

export default nextConfig;
