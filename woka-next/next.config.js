/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",

  // REQUIRED for GitHub Pages project sites
  basePath: "/woka-dashboard/woka-next",

  // REQUIRED so Next.js emits index.html in each folder
  trailingSlash: true,

  // GitHub Pages static hosting has no image optimizer
  images: { unoptimized: true }
};

module.exports = nextConfig;
