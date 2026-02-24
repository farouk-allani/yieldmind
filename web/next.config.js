/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@yieldmind/agents'],
  experimental: {
    serverComponentsExternalPackages: ['@hashgraph/sdk'],
  },
  webpack: (config) => {
    // Resolve .js imports to .ts source files (ESM compat for agents package)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return config;
  },
};

module.exports = nextConfig;
