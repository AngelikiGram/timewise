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
};

export default config;
