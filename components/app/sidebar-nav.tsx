'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

type NavItem = {
  href: string;
  key: string;
  label: string;
};

const iconPaths: Record<string, string[]> = {
  dashboard: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  documents: ['M6 3h9l3 3v15H6z', 'M14 3v4h4', 'M9 12h6', 'M9 16h6'],
  properties: ['M4 10h16v10H4z', 'M7 7h10v3H7z', 'M8 14h2', 'M12 14h2', 'M16 14h2', 'M8 17h2', 'M12 17h2', 'M16 17h2'],
  settings: ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v3', 'M12 19v3', 'M4.9 4.9l2.1 2.1', 'M17 17l2.1 2.1', 'M2 12h3', 'M19 12h3', 'M4.9 19.1 7 17', 'M17 7l2.1-2.1'],
  tax: ['M7 3h10v18H7z', 'M10 7h4', 'M10 11h4', 'M10 15h1', 'M14 15h1'],
  tenants: ['M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M3 19a5 5 0 0 1 10 0', 'M11 19a5 5 0 0 1 10 0']
};

export function SidebarNav({
  helpLabel,
  items,
  logoutAction,
  logoutLabel
}: {
  helpLabel: string;
  items: NavItem[];
  logoutAction: string;
  logoutLabel: string;
}) {
  const pathname = usePathname();

  return (
    <>
      <nav className="mt-8 grid gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.endsWith(item.href) || pathname.includes(`${item.href}/`);

          return (
            <Link
              className={[
                'focus-ring flex min-h-9 items-center gap-3 rounded-md px-3 text-[12px] font-semibold transition',
                active ? 'border-r-2 border-[var(--accent)] bg-[#eef7f4] text-[var(--accent)]' : 'text-[#253331] hover:bg-[#eef7f4] hover:text-[var(--accent)]'
              ].join(' ')}
              href={item.href}
              key={item.key}
            >
              <NavIcon active={active} name={item.key} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="absolute inset-x-4 bottom-5 grid gap-2">
        <button className="focus-ring flex min-h-9 items-center gap-3 rounded-md px-3 text-left text-[12px] font-medium text-[#253331] hover:bg-[#eef7f4]" type="button">
          <NavIcon name="help" />
          <span>{helpLabel}</span>
        </button>
        <form action={logoutAction} method="post">
          <button className="focus-ring flex min-h-9 w-full items-center gap-3 rounded-md px-3 text-left text-[12px] font-medium text-[#253331] hover:bg-[#eef7f4]" type="submit">
            <NavIcon name="logout" />
            <span>{logoutLabel}</span>
          </button>
        </form>
      </div>
    </>
  );
}

function NavIcon({active = false, name}: {active?: boolean; name: string}) {
  if (name === 'logout') {
    return (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
        <path d="M14 4h5v16h-5" />
      </svg>
    );
  }

  if (name === 'help') {
    return (
      <svg aria-hidden="true" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.1 1.9c-.9.6-1.6 1.2-1.6 2.4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className={['h-4 w-4 shrink-0', active ? 'text-[var(--accent)]' : 'text-[#253331]'].join(' ')}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
    >
      {(iconPaths[name] ?? iconPaths.dashboard).map((path) => (
        <path d={path} key={path} />
      ))}
    </svg>
  );
}
