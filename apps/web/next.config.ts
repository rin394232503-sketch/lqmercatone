import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 图片优化 - 使用 Supabase Storage CDN
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'yiyydikfpgbmtdypiggc.supabase.co',
      },
    ],
  },

  // API 代理到 NestJS 后端
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: `${process.env.API_URL || 'http://localhost:3001'}/api/v1/:path*`,
      },
    ];
  },

  // 国际化路由（暂不启用，手动切换）
  // i18n: {
  //   locales: ['it', 'zh'],
  //   defaultLocale: 'it',
  // },
};

export default nextConfig;
