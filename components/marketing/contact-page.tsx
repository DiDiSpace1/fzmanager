import Link from 'next/link';
import {useLocale, useTranslations} from 'next-intl';

export function ContactPage() {
  const locale = useLocale();
  const t = useTranslations('contact');
  const common = useTranslations('common');
  const prefix = locale === 'fr' ? '' : `/${locale}`;
  const localized = (path: string) => `${prefix}${path}`;

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <nav className="border-b border-[var(--line-soft)] bg-[var(--background)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
          <Link className="text-xl font-bold text-[var(--accent)]" href={localized('/')}>
            {common('appName')}
          </Link>
          <Link
            className="focus-ring rounded-md border border-[var(--line-soft)] bg-white px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--panel-muted)]"
            href={localized('/')}
          >
            {t('backHome')}
          </Link>
        </div>
      </nav>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
        <div className="mb-10 max-w-3xl">
          <h1 className="mb-3 text-[30px] font-semibold leading-[38px] text-[var(--foreground)]">{t('title')}</h1>
          <p className="text-base leading-6 text-[var(--muted)]">{t('intro')}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,0.95fr)]">
          <form action="/api/contact" className="ui-card rounded-lg p-5 md:p-8" method="post">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('nameLabel')} name="name" placeholder={t('namePlaceholder')} />
              <Field label={t('emailLabel')} name="email" placeholder={t('emailPlaceholder')} type="email" />
            </div>

            <label className="mt-4 block text-xs font-medium text-[var(--foreground)]">
              {t('subjectLabel')}
              <select className="mt-2 h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]" name="subject">
                <option>{t('subjectSupport')}</option>
                <option>{t('subjectFiscal')}</option>
                <option>{t('subjectBilling')}</option>
              </select>
            </label>

            <label className="mt-4 block text-xs font-medium text-[var(--foreground)]">
              {t('messageLabel')}
              <textarea
                className="mt-2 min-h-32 w-full resize-none rounded-md border border-[var(--line)] bg-white px-3 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
                name="message"
                placeholder={t('messagePlaceholder')}
              />
            </label>

            <button className="focus-ring mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-6 text-sm font-semibold !text-white transition-opacity hover:opacity-90" type="submit">
              {t('submit')}
              <span aria-hidden="true">-&gt;</span>
            </button>
          </form>

          <aside className="space-y-4">
            <div className="rounded-lg bg-[#008378] p-5 !text-white shadow-sm">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md bg-white/20 text-lg font-bold">?</div>
              <h2 className="mb-2 text-xl font-semibold leading-7">{t('supportTitle')}</h2>
              <p className="mb-6 text-sm font-semibold leading-5 text-[#d6fff7]">{t('supportCopy')}</p>
              <a className="mb-3 flex items-center gap-3 text-sm font-bold" href="mailto:support@loyelio.com">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">mail</span>
                support@loyelio.com
              </a>
              <p className="flex items-center gap-3 text-xs font-bold text-[#d6fff7]">
                <span aria-hidden="true" className="material-symbols-outlined text-[18px]">timer</span>
                {t('responseTime')}
              </p>
            </div>

            <div
              className="relative h-52 overflow-hidden rounded-lg border border-[var(--line-soft)] bg-[#d9e7e2] bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80')"
              }}
            >
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 !text-white">
                <p className="text-[11px] font-bold uppercase leading-4">{t('officeEyebrow')}</p>
                <p className="text-sm font-bold leading-5">{t('officeTitle')}</p>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--line)] bg-[var(--panel-muted)] p-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined mt-0.5 text-xl text-[var(--accent)]" aria-hidden="true">support_agent</span>
                <div>
                  <h3 className="text-sm font-bold leading-5">{t('faqTitle')}</h3>
                  <p className="text-xs leading-5 text-[var(--muted)]">{t('faqCopy')}</p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Field({label, name, placeholder, type = 'text'}: {label: string; name: string; placeholder: string; type?: string}) {
  return (
    <label className="block text-xs font-medium text-[var(--foreground)]">
      {label}
      <input
        className="mt-2 h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
        name={name}
        placeholder={placeholder}
        type={type}
      />
    </label>
  );
}
