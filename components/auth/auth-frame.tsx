import Link from 'next/link';

import {localizedPath} from '@/lib/navigation';

type AuthFrameProps = {
  children: React.ReactNode;
  footerText: string;
  legal: string;
  locale: string;
  privacy: string;
  tagline: string;
  terms: string;
};

export function AuthFrame({children, footerText, legal, locale, privacy, tagline, terms}: AuthFrameProps) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none fixed right-8 top-10 -z-0 hidden text-[220px] font-bold leading-none text-[var(--accent)] opacity-10 md:block">
        HL
      </div>
      <div className="pointer-events-none fixed bottom-10 left-8 -z-0 hidden text-[180px] font-bold leading-none text-[var(--accent)] opacity-10 md:block">
        LOG
      </div>

      <section className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 text-center">
            <Link className="inline-flex items-center justify-center text-[30px] font-semibold leading-[38px] tracking-[-0.02em] text-[var(--accent)]" href={localizedPath(locale, '/')}>
              HabitatLog
            </Link>
            <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{tagline}</p>
          </div>

          <div className="ui-card rounded-lg bg-white p-6">{children}</div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[var(--line-soft)] bg-white px-6 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-[var(--muted)] md:flex-row">
          <p>{footerText}</p>
          <div className="flex flex-wrap justify-center gap-6">
            <Link className="font-semibold hover:text-[var(--accent)]" href={localizedPath(locale, '/terms')}>
              {legal}
            </Link>
            <Link className="font-semibold hover:text-[var(--accent)]" href={localizedPath(locale, '/terms')}>
              {terms}
            </Link>
            <Link className="font-semibold hover:text-[var(--accent)]" href={localizedPath(locale, '/privacy')}>
              {privacy}
            </Link>
            <a className="font-semibold hover:text-[var(--accent)]" href="mailto:contact@habitatlog.com">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}

export function AuthSubmitButton({children}: {children: React.ReactNode}) {
  return (
    <button
      className="focus-ring min-h-12 w-full rounded-lg bg-[var(--accent)] px-5 text-base font-semibold !text-white transition-colors hover:bg-[#008378] active:scale-[0.99]"
      type="submit"
    >
      {children}
    </button>
  );
}

export function AuthTextInput({
  autoComplete,
  label,
  name,
  placeholder,
  required = true,
  type
}: {
  autoComplete?: string;
  label: string;
  name: string;
  placeholder: string;
  required?: boolean;
  type: 'email' | 'password';
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <input
        autoComplete={autoComplete}
        className="focus-ring rounded-md border border-[var(--line)] bg-white px-3 py-3 text-sm placeholder:text-[var(--outline)]"
        minLength={type === 'password' ? 6 : undefined}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}
