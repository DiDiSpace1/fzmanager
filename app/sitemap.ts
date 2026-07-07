import type {MetadataRoute} from 'next';

import {getAppUrl} from '@/lib/billing/config';

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getAppUrl();
  const now = new Date();

  return [
    {
      changeFrequency: 'weekly',
      lastModified: now,
      priority: 1,
      url: appUrl
    },
    {
      changeFrequency: 'monthly',
      lastModified: now,
      priority: 0.4,
      url: `${appUrl}/privacy`
    },
    {
      changeFrequency: 'monthly',
      lastModified: now,
      priority: 0.4,
      url: `${appUrl}/terms`
    }
  ];
}
