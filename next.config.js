/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    tsconfigPath: './tsconfig.json',
    ignoreBuildErrors: true,
  },
  experimental: {
    taint: true,
    optimizePackageImports: [
      'lucide-react',
      'lodash',
      'date-fns'],
  },
};

module.exports = nextConfig;
