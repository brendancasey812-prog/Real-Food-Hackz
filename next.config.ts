import type { NextConfig } from "next";

/**
 * Two deployment targets from one codebase:
 *
 *  - BUILD_TARGET=pages  → static export for GitHub Pages, served from
 *    https://<user>.github.io/Web-app/. No server, so no API routes; the
 *    workflow removes src/app/api before building and AI features fall back
 *    to the user's own Anthropic key.
 *
 *  - anything else (Vercel, local dev) → a normal server build with API
 *    routes, so ANTHROPIC_API_KEY can stay on the server.
 *
 * Firebase auth + Firestore are client-side, so cloud sync works on both.
 */
const repo = "Web-app";
const isPages = process.env.BUILD_TARGET === "pages";

const nextConfig: NextConfig = {
  ...(isPages
    ? {
        output: "export" as const,
        basePath: `/${repo}`,
        assetPrefix: `/${repo}/`,
      }
    : {}),
  // Next's image optimizer needs a server; the static export uses plain <img>.
  images: { unoptimized: isPages },
  // Emit /kitchen/index.html style folders so refreshes work on GitHub Pages.
  trailingSlash: true,
  env: {
    // Lets the client know whether /api/anthropic exists in this build.
    NEXT_PUBLIC_SERVER_AI: isPages ? "0" : "1",
  },
};

export default nextConfig;
