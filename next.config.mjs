// Set BASE_PATH at image build time to override (e.g. BASE_PATH='' for root).
const basePath = process.env.BASE_PATH ?? "/dashboard";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cache Components: prerender the shell + data layer with `use cache`,
  // so pages ship with data in the initial HTML instead of a client fetch.
  cacheComponents: true,
  // Output a self-contained server bundle for Docker deployments.
  output: "standalone",
  basePath,
  // Next.js prefixes basePath onto <Link>/router/assets but NOT fetch(); expose
  // it so client-side API calls can prefix it themselves (see lib/client.ts).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
