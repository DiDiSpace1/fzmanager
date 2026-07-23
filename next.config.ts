import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n/request.ts');

export default withNextIntl({
  experimental: {
    serverActions: {
      bodySizeLimit: '80mb'
    }
  },
  images: {
    remotePatterns: [
      {
        hostname: 'images.unsplash.com',
        protocol: 'https'
      }
    ]
  },
  turbopack: {
    root: process.cwd()
  }
});
