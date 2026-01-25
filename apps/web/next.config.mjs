/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add the names of your local packages here
  transpilePackages: ["@repo/ui", "@repo/utils"],
};

export default nextConfig;
