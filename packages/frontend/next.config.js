/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@arena/shared'],
  images: {
    domains: ['api.dicebear.com'],
  },
};

module.exports = nextConfig;
