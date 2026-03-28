/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",

  // ✅ Your correct basePath for GitHub Pages project site
  basePath: "/woka-dashboard",

  // ✅ Required for GitHub Pages — produces /index.html properly
  trailingSlash: true,

  // ✅ Prevents Next.js from trying to optimize images (not supported on GH Pages)
  images: {
    unoptimized: true
  }
};

module.exports = nextConfig;
