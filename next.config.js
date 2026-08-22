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
        source: '/note',
        destination: '/app',
        permanent: true,
      },
      {
        source: '/note/:path*',
        destination: '/app/:path*',
        permanent: true,
      },
      {
        source: '/send',
        destination: '/app',
        permanent: true,
      },
      {
        source: '/send/:noteId',
        destination: '/idea/:noteId',
        permanent: true,
      },
      {
        source: '/send/:noteId/:key*',
        destination: '/idea/:noteId/:key*',
        permanent: true,
      },
      {
        source: '/app/shared/:noteId',
        destination: '/idea/:noteId',
        permanent: true,
      },
      {
        source: '/app/shared/:noteId/:key*',
        destination: '/idea/:noteId/:key*',
        permanent: true,
      },
      {
        source: '/app/notes',
        destination: '/app',
        permanent: true,
      },
      {
        source: '/app/notes/:path*',
        destination: '/app/:path*',
        permanent: true,
      },
      {
        source: '/app/:id/opengraph-image',
        destination: '/idea/:id/opengraph-image',
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
        source: '/flow/goal/:id',
        destination: '/goal/:id',
        permanent: true,
      },
      {
        source: '/flow/goal/:id/:path*',
        destination: '/goal/:id/:path*',
        permanent: true,
      },
      {
        source: '/flow/goals',
        destination: '/goals',
        permanent: true,
      },
      {
        source: '/flow/goals/:path*',
        destination: '/goals/:path*',
        permanent: true,
      },
      {
        source: '/flow/forms',
        destination: '/forms',
        permanent: true,
      },
      {
        source: '/flow/forms/:path*',
        destination: '/forms/:path*',
        permanent: true,
      },
      {
        source: '/flow/form/:id',
        destination: '/form/:id',
        permanent: true,
      },
      {
        source: '/flow/form/:id/:path*',
        destination: '/form/:id/:path*',
        permanent: true,
      },
      {
        source: '/flow/events',
        destination: '/events',
        permanent: true,
      },
      {
        source: '/flow/events/:path*',
        destination: '/events/:path*',
        permanent: true,
      },
      {
        source: '/flow/event/:id',
        destination: '/events/:id',
        permanent: true,
      },
      {
        source: '/flow/event/:id/:path*',
        destination: '/events/:id/:path*',
        permanent: true,
      },
      {
        source: '/flow/tasks',
        destination: '/goals',
        permanent: true,
      },
      {
        source: '/flow/tasks/:path*',
        destination: '/goals/:path*',
        permanent: true,
      },
      {
        source: '/flow',
        destination: '/flows',
        permanent: true,
      },
      {
        source: '/workflows',
        destination: '/flows',
        permanent: true,
      },
      {
        source: '/workflows/:path*',
        destination: '/flows',
        permanent: true,
      },
      {
        source: '/projects/workflows',
        destination: '/flows',
        permanent: true,
      },
      {
        source: '/projects/workflows/:path*',
        destination: '/flows',
        permanent: true,
      },
      {
        source: '/projects',
        destination: '/app',
        permanent: true,
      },
      {
        source: '/projects/:projectId',
        destination: '/workspace/:projectId',
        permanent: true,
      },
      {
        source: '/projects/:projectId/:path+',
        destination: '/workspace/:projectId',
        permanent: true,
      },
      {
        source: '/project/:projectId',
        destination: '/workspace/:projectId',
        permanent: true,
      },
      {
        source: '/project/:projectId/:path+',
        destination: '/workspace/:projectId',
        permanent: true,
      },
      {
        source: '/workspaces',
        destination: '/app',
        permanent: true,
      },
      {
        source: '/workspaces/:projectId',
        destination: '/workspace/:projectId',
        permanent: true,
      },
      {
        source: '/workspaces/:projectId/:path+',
        destination: '/workspace/:projectId',
        permanent: true,
      },
      {
        source: '/workspace',
        destination: '/app',
        permanent: true,
      },
      {
        source: '/workspace/:projectId/:path+',
        destination: '/workspace/:projectId',
        permanent: true,
      },
      {
        source: '/accounts/settings',
        destination: '/settings',
        permanent: true,
      },
      {
        source: '/accounts/settings/:path*',
        destination: '/settings',
        permanent: true,
      },
      {
        source: '/accounts/billing',
        destination: '/settings',
        permanent: true,
      },
      {
        source: '/accounts/login',
        destination: '/',
        permanent: true,
      },
      {
        source: '/accounts',
        destination: '/',
        permanent: true,
      },
      {
        source: '/accounts/subscription/pro/checkout',
        destination: '/billing/checkout',
        permanent: true,
      },
      {
        source: '/accounts/subscription/pro/checkout/:path*',
        destination: '/billing/checkout',
        permanent: true,
      },
      {
        source: '/accounts/pro/success',
        destination: '/billing/success',
        permanent: true,
      },
      {
        source: '/accounts/coupon/:id',
        destination: '/billing/coupon/:id',
        permanent: true,
      },
      {
        source: '/accounts/admin',
        destination: '/settings?section=admin',
        permanent: false,
      },
      {
        source: '/accounts/admin/:path*',
        destination: '/settings?section=admin',
        permanent: false,
      },
      {
        source: '/accounts/handoff',
        destination: '/',
        permanent: true,
      },
      {
        source: '/accounts/resume',
        destination: '/',
        permanent: true,
      },
      {
        source: '/accounts/silent-check',
        destination: '/',
        permanent: true,
      },
      {
        source: '/accounts/referral/:username',
        destination: '/r/:username',
        permanent: true,
      },
      {
        source: '/accounts/api/pro/notify',
        destination: '/billing/api/pro/notify',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
