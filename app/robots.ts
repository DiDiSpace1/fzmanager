import type {MetadataRoute} from 'next';

import {getAppUrl} from '@/lib/billing/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        allow: ['/', '/privacy', '/terms'],
        disallow: ['/dashboard', '/documents', '/properties', '/settings', '/tax', '/tenants', '/api'],
        userAgent: '*'
      }
    ],
    sitemap: `${getAppUrl()}/sitemap.xml`
  };
}
