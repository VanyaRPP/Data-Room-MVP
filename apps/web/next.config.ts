import type { NextConfig } from "next";

const apiUrl = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Same-origin proxy to the API: the browser only ever talks to the
        // Next.js origin, so the session cookie can be SameSite=Lax with no
        // CORS configuration on either side. See README "Design decisions".
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
