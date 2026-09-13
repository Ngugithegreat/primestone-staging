/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the workspace root — an unrelated lockfile above this directory
  // otherwise makes Turbopack infer the wrong one.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
