import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep a little multipart overhead above the 500 MB application file limit.
    proxyClientMaxBodySize: "512mb",
  },
  serverExternalPackages: [
    "@tesseract.js-data/chi_sim",
    "@napi-rs/canvas",
    "pdfjs-dist",
    "tesseract.js",
  ],
};

export default nextConfig;
