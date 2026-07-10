import type {Metadata} from 'next';
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import {notFound} from 'next/navigation';

import '../globals.css';
import {CookieNotice} from '@/components/app/cookie-notice';
import {locales, type Locale} from '@/lib/i18n/routing';

export const metadata: Metadata = {
  description: 'Loyers, justificatifs et dossier fiscal pour petits bailleurs LMNP.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    description: 'Classez vos loyers, factures et contrats, puis exportez un dossier fiscal clair.',
    locale: 'fr_FR',
    siteName: 'HabitatLog',
    title: 'HabitatLog',
    type: 'website'
  },
  robots: {
    follow: true,
    index: true
  },
  title: {
    default: 'HabitatLog',
    template: '%s | HabitatLog'
  }
};

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
};

export default async function LocaleLayout({children, params}: LocaleLayoutProps) {
  const {locale} = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link href="https://fonts.googleapis.com" rel="preconnect" />
        <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0&display=optional" rel="stylesheet" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
          <CookieNotice />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
