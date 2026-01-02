import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow development from other devices on the network
  experimental: {
    turbopackUseSystemTlsCerts: true,
    serverActions: {
      allowedOrigins: ["localhost:3000", "10.60.52.36:3000", "0.0.0.0:3000"]
    }
  },
};

export default nextConfig;
