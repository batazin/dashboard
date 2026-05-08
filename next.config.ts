import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://localhost:3000',
  },
  typescript: {
    ignoreBuildErrors: true,
  },

};

export default nextConfig;
