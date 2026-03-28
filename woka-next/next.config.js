/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/woka-dashboard/woka-next",
  trailingSlash: true,
  images: { unoptimized: true }
};

module.exports = nextConfig;
