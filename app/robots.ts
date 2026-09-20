import type { MetadataRoute } from 'next';
import { getProductSiteUrl } from '@/lib/config/product';

export const revalidate = 86400;

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getProductSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/pricing',
          '/docs',
          '/docs/*',
          '/terms-of-service',
          '/privacy-policy',
        ],
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
          '/*?*ref=*',
        ],
      },
      {
        userAgent: [
          'GPTBot',
          'ChatGPT-User',
          'ClaudeBot',
          'Claude-Web',
          'AnthropicAI',
          'PerplexityBot',
          'cohere-ai',
          'Google-Extended',
          'Applebot-Extended',
        ],
        allow: [
          '/',
          '/pricing',
          '/docs',
          '/docs/*',
          '/terms-of-service',
          '/privacy-policy',
        ],
        disallow: [
          '/app/',
          '/vault/',
          '/settings/',
          '/billing/',
          '/*?*ref=*',
        ],
      },
      {
        userAgent: [
          'Bytespider',
          'PetalBot',
          'Scrapy',
          'CCBot',
        ],
        disallow: ['/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
