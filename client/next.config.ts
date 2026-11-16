import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // this folder is the app root; without it Next can pick up a package.json / lockfile higher up the tree
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname),
  },
  // no remote images are allowed: the only image (public/bortle.png) is served from this app
};

export default nextConfig;
