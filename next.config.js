/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  transpilePackages: ["reagraph", "three", "troika-three-text", "troika-worker-utils"],
  webpack: (config) => {
    config.output.globalObject = "self";
    return config;
  },
};

module.exports = nextConfig;
