'use client';

import {useRouter} from 'next/navigation';

import {localizedPath} from '@/lib/navigation';

type PropertyOption = {
  id: string;
  name: string;
};

export function PropertySelector({
  locale,
  properties,
  selectedPropertyId
}: {
  locale: string;
  properties: PropertyOption[];
  selectedPropertyId?: string;
}) {
  const router = useRouter();

  return (
    <label className="grid gap-2 text-xs font-semibold text-[#33413f]">
      Bien
      <select
        className="focus-ring min-h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-normal"
        defaultValue={selectedPropertyId ?? ''}
        name="property_picker"
        onChange={(event) => {
          const propertyId = event.target.value;
          const path = propertyId ? `/bail?property_id=${propertyId}` : '/bail';
          router.push(localizedPath(locale, path as `/${string}`));
        }}
      >
        <option value="">Veuillez choisir votre bien</option>
        {properties.map((property) => (
          <option key={property.id} value={property.id}>
            {property.name}
          </option>
        ))}
      </select>
    </label>
  );
}
