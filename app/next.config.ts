import type { NextConfig } from "next";

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https: http:",
  "style-src-elem 'self' 'unsafe-inline' https: http:",
  "font-src 'self' https: data:",
  "img-src 'self' data: https: blob:",
  "connect-src 'self' https: wss: ws: http://127.0.0.1:* http://localhost:* https://hermes.pyth.network https://api.coingecko.com https://api.binance.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
  turbopack: {
    root: __dirname,
    resolveAlias: {
      // Prevent Turbopack issues with certain packages
      "three": "three",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/rpc",
        destination: "http://127.0.0.1:8899",
      },
    ];
  },
  // Improve chunk loading reliability
  experimental: {
    optimizePackageImports: ["three", "@react-three/fiber", "@react-three/drei", "lucide-react"],
  },
  // Webpack fallback for Turbopack issues
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Reduce chunk splitting in development to avoid ChunkLoadError
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          default: false,
          vendors: false,
        },
      };
    }
    return config;
  },
};

export default nextConfig;
