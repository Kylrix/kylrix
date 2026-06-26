const webpack = require('webpack');

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SELFHOSTED: process.env.SELFHOSTED === 'true' ? 'true' : 'false',
  },
  // Standalone output produces a self-contained server in .next/standalone
  // Required for efficient Docker deployments (no node_modules in final image)
  output: 'standalone',
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: false,
  },
  experimental: {
    taint: true,
    optimizePackageImports: [
      'lucide-react',
      'lodash',
      'date-fns'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: false,
        fs: false,
        path: false,
        stream: false,
      };
      // Strip 'node:' prefix from imports to prevent UnhandledSchemeError
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        })
      );
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: '/note/notes',
        destination: '/note',
        permanent: true,
      },
      {
        source: '/note/notes/:path*',
        destination: '/note/:path*',
        permanent: true,
      },
      {
        source: '/vault/dashboard',
        destination: '/vault',
        permanent: true,
      },
      {
        source: '/vault/dashboard/:path*',
        destination: '/vault/:path*',
        permanent: true,
      },
      {
        source: '/flow/goals',
        destination: '/flow',
        permanent: true,
      },
      {
        source: '/flow/goals/:path*',
        destination: '/flow/:path*',
        permanent: true,
      },
      {
        source: '/flow/tasks',
        destination: '/flow',
        permanent: true,
      },
      {
        source: '/flow/tasks/:path*',
        destination: '/flow/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
