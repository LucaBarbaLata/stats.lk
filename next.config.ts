import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  async redirects() {
    return [
      { source: "/top", destination: "/top/tracks", permanent: false },
      { source: "/insights", destination: "/insights/compare", permanent: false },
      { source: "/insights/milestones", destination: "/insights/trophies", permanent: true },
      { source: "/settings", destination: "/settings/profile", permanent: false },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // App pages read the session, so dev would flag every one as not instant;
    // they show loading.tsx instead. Only validate segments that export `instant`.
    instantInsights: { validationLevel: "manual-warning" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
