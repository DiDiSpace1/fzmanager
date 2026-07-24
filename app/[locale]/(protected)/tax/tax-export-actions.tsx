'use client';

import Link from 'next/link';
import {useTranslations} from 'next-intl';
import {useState} from 'react';

type UpgradeTarget = 'plus' | 'solo';

export function TaxExportActions({
  canExportCsv,
  canExportZip,
  csvUrl,
  settingsUrl,
  zipUrl
}: {
  canExportCsv: boolean;
  canExportZip: boolean;
  csvUrl: string;
  settingsUrl: string;
  zipUrl: string;
}) {
  const t = useTranslations('tax');
  const [upgradeTarget, setUpgradeTarget] = useState<UpgradeTarget | null>(null);

  const buttonClass = 'focus-ring inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[#3d4947] hover:bg-[#f0f5f2]';

  return (
    <>
      <div className="flex flex-col items-start gap-2 md:ml-auto md:items-end">
        <div className="flex flex-wrap justify-end gap-3">
          {canExportCsv ? (
            <a className={buttonClass} href={csvUrl}>
              <Icon name="download" />
              {t('exportCsv')}
            </a>
          ) : (
            <button className={`${buttonClass} opacity-80`} onClick={() => setUpgradeTarget('solo')} type="button">
              <Icon name="download" />
              {t('exportCsv')}
            </button>
          )}
          {canExportZip ? (
            <a className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[#005049]" href={zipUrl} style={{color: '#ffffff'}}>
              <Icon name="folder_zip" />
              {t('exportZip')}
            </a>
          ) : (
            <button className={`${buttonClass} opacity-80`} onClick={() => setUpgradeTarget('plus')} type="button">
              <Icon name="folder_zip" />
              {t('exportZip')}
            </button>
          )}
        </div>
        {!canExportCsv ? <p className="text-xs text-[var(--muted)]">{t('csvUpgradeNote')}</p> : !canExportZip ? <p className="text-xs text-[var(--muted)]">{t('zipUpgradeNote')}</p> : null}
      </div>

      {upgradeTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-6 text-[#17201e] shadow-2xl">
            <h2 className="text-xl font-semibold">{t('upgradeTitle', {plan: upgradeTarget === 'solo' ? 'Solo' : 'Plus'})}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t(upgradeTarget === 'solo' ? 'upgradeCsvCopy' : 'upgradeZipCopy')}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="min-h-10 rounded-lg border border-[var(--line)] px-4 text-sm font-semibold hover:bg-[#f0f5f2]" onClick={() => setUpgradeTarget(null)} type="button">
                {t('upgradeLater')}
              </button>
              <Link className="inline-flex min-h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-white" href={settingsUrl} style={{color: '#ffffff'}}>
                {t('upgradeAction')}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Icon({name}: {name: string}) {
  return <span className="material-symbols-outlined text-[19px]">{name}</span>;
}
