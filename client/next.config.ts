import path from "node:path";
import { withSerwist } from "@serwist/turbopack";
import type { NextConfig } from "next";

// The repo root, one level above this app. Both roots must agree, and hosts
// that build from a subfolder set the tracing root to the repo root.
const repoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  outputFileTracingRoot: repoRoot,
  // Pinned so stray lockfiles outside the repo aren't inferred as the workspace root.
  turbopack: {
    root: repoRoot,
  },
};

// Keeps esbuild external so the /serwist/[path] route can bundle the service worker.
export default withSerwist(nextConfig);
