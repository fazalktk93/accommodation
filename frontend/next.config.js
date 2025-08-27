// next.config.js
/** @type {import('next').NextConfig} */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://192.168.1.7:8000";

module.exports = {
  async rewrites() {
    return [
      // Proxy browser requests like /api/auth/login -> http://<server>:8000/auth/login
      { source: "/api/:path*", destination: `${API_BASE}/:path*` },
    ];
  },
  reactStrictMode: true,
};
