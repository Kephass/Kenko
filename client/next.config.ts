import type { NextConfig } from "next";

// next-pwa is installed (per SCAFFOLD.md) but not wired in yet: it targets
// webpack and Next.js 16 builds with Turbopack. The manifest + icons in
// public/ already make the app installable; add a service worker (e.g. via
// serwist) when offline support becomes a real need.
const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
