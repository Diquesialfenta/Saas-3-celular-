import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Modelo de renderizado dinámico clásico: casi toda la app depende de la sesión.
  cacheComponents: false,
  serverExternalPackages: ["@prisma/client", "bcryptjs", "nodemailer"],
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
