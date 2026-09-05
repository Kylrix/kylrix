import type { MetadataRoute } from 'next';
import { getProductSiteUrl } from '@/lib/config/product';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getProductSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing'],
        disallow: [
          '/app/',
          '/idea/',
          '/flow/',
          '/flows/',
          '/goal/',
          '/goals/',
          '/form/',
          '/forms/',
          '/events/',
          '/workspaces/',
          '/vault/',
          '/settings/',
          '/api/',
          '/billing/',
          '/u/',
          '/moment/',
          '/*?*ref=*',
        ],
      },
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'CCBot',
          'AnthropicAI',
          'Claude-Web',
          'cohere-ai',
          'Bytespider',
          'PetalBot',
          'Scrapy',
        ],
        disallow: ['/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
