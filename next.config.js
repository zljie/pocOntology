/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  transpilePackages: ["reagraph", "three", "troika-three-text", "troika-worker-utils"],
  webpack: (config) => {
    config.output.globalObject = "self";
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "troika-worker-utils": path.resolve(__dirname, "shims/troika-worker-utils.ts"),
    };
    return config;
  },
};

module.exports = nextConfig;
