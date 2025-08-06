/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  env: {
    NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
    NEXT_PUBLIC_CROSSMINT_CLIENT_KEY:
      process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_KEY,
    NEXT_PUBLIC_AUTH_REDIRECT_URL:
      process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL || 'symlog://auth',
  },
  output: 'standalone',
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Handle missing modules in browser environment
      config.resolve.fallback = {
        ...config.resolve.fallback,
        '@react-native-async-storage/async-storage': false,
        'pino-pretty': false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://staging.crossmint.com https://www.crossmint.com https://*.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com https://*.gstatic.com data: https:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://staging.crossmint.com https://www.crossmint.com https://*.convex.cloud wss://*.convex.cloud https://dynamic-static-assets.com https://*.dynamic-static-assets.com https://api.dynamic.xyz https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org",
              "frame-src 'self' https://staging.crossmint.com https://www.crossmint.com",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
