import { createSerwistRoute } from "@serwist/turbopack";

// Serves /serwist/sw.js (+ sourcemap) with Service-Worker-Allowed: /.
export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
  esbuildOptions: {
    define: {
      "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
  },
});
