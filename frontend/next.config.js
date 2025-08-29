// next.config.js
/** @type {import('next').NextConfig} */

// If Next.js (port 3000) and FastAPI (port 8000) run on the SAME server,
// this default works. If they are on DIFFERENT hosts, set BACKEND_ORIGIN to that host.
const API_BASE = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";

module.exports = {
  async rewrites() {
    return [
      // proxy /api/* → FastAPI /*  (no CORS; no localhost confusion)
      { source: "/api/:path*", destination: "http://127.0.0.1:8000/:path*" },
    ];
  },
  reactStrictMode: true,
};
