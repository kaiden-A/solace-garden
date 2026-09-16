import type { NextConfig } from "next";

// Where the FastAPI server lives. Same origin as far as the browser is
// concerned: everything under /api (except the YouTube oEmbed proxy, which
// stays local) is proxied here.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // The repo root has its own package-lock.json (for `npm run dev`), which
  // otherwise makes Next infer the workspace root one level up.
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    return {
      // afterFiles: real route handlers win, so app/api/music/oembed keeps
      // working locally while the rest of /api goes to FastAPI.
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${API_ORIGIN}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
