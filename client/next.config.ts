import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pinned so stray lockfiles outside the repo aren't inferred as the workspace root.
  turbopack: {
    root: __dirname,
  },
};

// Keeps esbuild external so the /serwist/[path] route can bundle the service worker.
export default withSerwist(nextConfig);
