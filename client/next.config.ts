import type { NextConfig } from "next";

// No service worker yet; use @serwist/turbopack when offline support is needed.
const nextConfig: NextConfig = {
  // Pinned so stray lockfiles outside the repo aren't inferred as the workspace root.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
