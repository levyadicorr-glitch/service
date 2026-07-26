import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: '/:tenantId/admin/whatsapp/webhook',
        destination: '/api/:tenantId/whatsapp/webhook',
      },
      {
        source: '/:tenantId/whatsapp/webhook',
        destination: '/api/:tenantId/whatsapp/webhook',
      },
    ];
  },
};

export default nextConfig;
