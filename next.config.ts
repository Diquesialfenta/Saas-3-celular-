import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

if (process.env.NODE_ENV === "development") void initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  // Modelo de renderizado dinámico clásico: casi toda la app depende de la sesión.
  cacheComponents: false,
  serverExternalPackages: ["bcryptjs"],
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
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
