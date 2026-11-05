import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/relayer.ts reads mocks/*.json from disk; make sure Vercel bundles them.
  outputFileTracingIncludes: {
    "/**": ["./mocks/**/*.json"],
  },
};

export default nextConfig;
