/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache Components: prerender the shell + data layer with `use cache`,
  // so pages ship with data in the initial HTML instead of a client fetch.
  cacheComponents: true,
  // Output a self-contained server bundle for Docker deployments.
  output: "standalone",
  // Set BASE_PATH at image build time to override (e.g. BASE_PATH='' for root).
  basePath: process.env.BASE_PATH ?? "/dashboard",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
