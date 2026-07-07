import type { NextConfig } from "next";

// No service worker yet: the manifest + icons in public/ already make the
// app installable. When offline support becomes a real need, use
// @serwist/turbopack (next-pwa is webpack-only and can't run under
// Turbopack builds).
const nextConfig: NextConfig = {
  // Pin the workspace root: a stray lockfile elsewhere (e.g. ~/pnpm-lock.yaml)
  // otherwise makes Next.js infer the wrong root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
