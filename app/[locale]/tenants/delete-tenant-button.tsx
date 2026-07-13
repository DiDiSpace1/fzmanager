'use client';

import {ConfirmSubmitButton} from '@/components/app/confirm-submit-button';

export function DeleteTenantButton() {
  return (
    <ConfirmSubmitButton
      className="block w-full rounded-md px-3 py-2 text-left text-[#ba1a1a] hover:bg-[#fff1f1]"
      confirmLabel="Supprimer"
      description="Supprimer ce locataire supprimera aussi ses donnees historiques liees aux baux, loyers et documents."
      title="Supprimer ce locataire ?"
    >
      Supprimer
    </ConfirmSubmitButton>
  );
}
