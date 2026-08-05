import type { NextConfig } from "next";

// The repository name — the site is served from https://<user>.github.io/<repo>/
const repo = "Web-app";
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // Produce a fully static site (plain HTML/CSS/JS) that GitHub Pages can host.
  output: "export",
  // GitHub Pages serves this project under a /Web-app/ sub-path in production.
  basePath: isProd ? `/${repo}` : "",
  assetPrefix: isProd ? `/${repo}/` : "",
  // Next's image optimizer needs a server; static export uses plain <img> instead.
  images: { unoptimized: true },
  // Emit /kitchen/index.html style folders so refreshes work on GitHub Pages.
  trailingSlash: true,
};

export default nextConfig;
