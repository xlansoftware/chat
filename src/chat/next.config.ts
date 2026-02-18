import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  env: {
    NEXT_PUBLIC_VERSION: process.env.APP_VERSION,
    NEXT_PUBLIC_COMMIT_HASH: process.env.APP_COMMIT_HASH,
  },
};

export default nextConfig;
