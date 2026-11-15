import path from "node:path";
import type { NextConfig } from "next";

const root = path.join(__dirname, "../..");

const config: NextConfig = {
  transpilePackages: ["@timewise/historical-schemas"],
  outputFileTracingRoot: root,
  turbopack: { root },
  // Opening the dev server from another device on the home network uses this machine's LAN address.
  // Without it, Next.js blocks the dev scripts and pages never get past their loading state.
  allowedDevOrigins: ["192.168.0.160"],
  output: "export",
  // GitHub Pages serves the site from /<repository>/. Empty locally.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  // On GitHub Pages every page becomes <path>/index.html, so /history (a page) isn't confused with
  // history/ (the folder holding /history/europe), which Pages answers with a 404. Local URLs stay as they are.
  trailingSlash: Boolean(process.env.NEXT_PUBLIC_BASE_PATH),
};

export default config;
