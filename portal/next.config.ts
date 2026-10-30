import type { NextConfig } from "next";

// Every portal page is per-user and reads the session cookie, so everything renders dynamically.
const nextConfig: NextConfig = {
  cacheComponents: false,
  devIndicators: false,
  // Private media is read at request time, so make sure deployments ship the storage folder.
  outputFileTracingIncludes: { "/api/media/[id]": ["./storage/**"] },
  serverExternalPackages: ["pg", "nodemailer"],
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "same-origin" },
      ],
    }];
  },
};

export default nextConfig;
