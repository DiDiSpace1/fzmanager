import Link from 'next/link';
import {getTranslations} from 'next-intl/server';

export default async function PrivacyPage() {
  const common = await getTranslations('common');
  const t = await getTranslations('legal.privacy');
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'support@fzmanager.app';

  return (
    <main className="min-h-screen bg-[#f7f6f2] px-5 py-8">
      <article className="mx-auto max-w-3xl rounded-lg border border-[var(--line)] bg-white p-6">
        <p className="text-sm font-semibold text-[var(--accent)]">{t('updated')}</p>
        <h1 className="mt-3 text-3xl font-semibold">{t('title')}</h1>
        <div className="mt-6 grid gap-6 text-sm leading-7 text-[var(--muted)]">
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{t('collectedTitle')}</h2>
            <p className="mt-2">{t('collectedCopy')}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{t('usageTitle')}</h2>
            <p className="mt-2">{t('usageCopy')}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{t('processorsTitle')}</h2>
            <p className="mt-2">{t('processorsCopy')}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{t('rightsTitle')}</h2>
            <p className="mt-2">{t('rightsCopy')}</p>
          </section>
          <section>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">{common('contact')}</h2>
            <p className="mt-2">
              {t('contactCopy')} <a className="font-semibold text-[var(--accent)]" href={`mailto:${supportEmail}`}>{supportEmail}</a>.
            </p>
          </section>
        </div>
        <Link className="focus-ring mt-8 inline-flex min-h-11 items-center rounded-md border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f2f0ea]" href="/">
          {common('back')}
        </Link>
      </article>
    </main>
  );
}
