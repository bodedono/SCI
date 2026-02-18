import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inline env vars at build time as fallback for Cloudflare Edge Runtime
  env: {
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
    GOOGLE_SPREADSHEET_ID: process.env.GOOGLE_SPREADSHEET_ID,
  },
};

export default nextConfig;
