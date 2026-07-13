'use client';

import {useTranslations} from 'next-intl';

import {ConfirmSubmitButton} from '@/components/app/confirm-submit-button';

export function DeleteTenantButton() {
  const common = useTranslations('common');
  const t = useTranslations('tenants.actions');

  return (
    <ConfirmSubmitButton
      className="block w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff1f1]"
      confirmLabel={common('delete')}
      description={t('deleteDescription')}
      title={t('deleteTitle')}
    >
      {common('delete')}
    </ConfirmSubmitButton>
  );
}
