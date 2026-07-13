'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import type {SupabaseClient} from '@supabase/supabase-js';

import {localizedPath} from '@/lib/navigation';
import {getPlanLimits, getPropertyPhotoLimit} from '@/lib/billing/config';
import {canCreateResource} from '@/lib/billing/limits';
import {buildRentChargesForLease} from '@/lib/rent/charges';
import {getCurrentUserWorkspace} from '@/lib/workspace';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function values(formData: FormData, key: string) {
  return formData.getAll(key).map((entry) => (typeof entry === 'string' ? entry.trim() : ''));
}

function moneyValue(formData: FormData, key: string) {
  const raw = value(formData, key).replace(',', '.');
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numericValue(formData: FormData, key: string) {
  const raw = value(formData, key).replace(',', '.');
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function imageFiles(formData: FormData) {
  return formData.getAll('photos').filter((entry): entry is File => entry instanceof File && entry.size > 0 && entry.type.startsWith('image/'));
}

function hasOversizedFile(files: File[], maxSizeBytes: number) {
  return files.some((file) => file.size > maxSizeBytes);
}

function moneyValues(formData: FormData, key: string) {
  return values(formData, key).map((entry) => {
    const parsed = Number.parseFloat(entry.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

async function uploadPropertyPhotos({
  coverOffset = 0,
  files,
  propertyId,
  supabase,
  workspaceId
}: {
  coverOffset?: number;
  files: File[];
  propertyId: string;
  supabase: SupabaseClient;
  workspaceId: string;
}) {
  for (const [index, file] of files.entries()) {
    const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const filePath = `workspace/${workspaceId}/properties/${propertyId}/${crypto.randomUUID()}.${extension}`;
    const {error: uploadError} = await supabase.storage.from('property-photos').upload(filePath, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false
    });

    if (uploadError) {
      return false;
    }

    const {error: photoError} = await supabase.from('property_photos').insert({
      file_name: file.name,
      file_path: filePath,
      is_cover: coverOffset + index === 0,
      mime_type: file.type || null,
      property_id: propertyId,
      size_bytes: file.size,
      sort_order: index,
      workspace_id: workspaceId
    });

    if (photoError) {
      await supabase.storage.from('property-photos').remove([filePath]);
      return false;
    }
  }

  return true;
}

export async function createPropertyAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const name = value(formData, 'name');
  const rentalMode = value(formData, 'rental_mode') || 'shared_rooms';
  const photos = imageFiles(formData);

  if (!name) {
    redirect(`${localizedPath(locale, '/properties')}?error=missing_name`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const planGate = await canCreateResource(supabase, workspaceId, 'properties');

  if (!planGate.allowed) {
    redirect(`${localizedPath(locale, '/properties')}?error=plan_limit`);
  }

  const photoLimit = getPropertyPhotoLimit(planGate.billing?.plan);
  const planLimits = getPlanLimits(planGate.billing?.plan);

  if (photos.length > photoLimit) {
    redirect(`${localizedPath(locale, '/properties')}?error=photo_limit`);
  }

  if (hasOversizedFile(photos, planLimits.maxDocumentSizeBytes)) {
    redirect(`${localizedPath(locale, '/properties')}?new=1&error=photo_size`);
  }

  const {data: property, error} = await supabase
    .from('properties')
    .insert({
      address_line1: value(formData, 'address_line1') || null,
      city: value(formData, 'city') || null,
      country_code: 'FR',
      charges_estimate: null,
      deposit_estimate: null,
      monthly_rent_estimate: null,
      name,
      occupancy_status: 'vacant',
      postal_code: value(formData, 'postal_code') || null,
      property_type: value(formData, 'property_type') || 'apartment',
      rental_mode: rentalMode,
      surface_area: numericValue(formData, 'surface_area'),
      tax_regime: 'LMNP',
      workspace_id: workspaceId
    })
    .select('id')
    .single();

  if (error || !property) {
    redirect(`${localizedPath(locale, '/properties')}?error=create_failed`);
  }

  if (rentalMode === 'entire_place') {
    await supabase.from('units').insert({
      name: 'Logement entier',
      property_id: property.id,
      unit_type: 'apartment',
      workspace_id: workspaceId
    });
  }

  if (photos.length) {
    const uploaded = await uploadPropertyPhotos({files: photos, propertyId: property.id, supabase, workspaceId});

    if (!uploaded) {
      redirect(`${localizedPath(locale, `/properties/${property.id}`)}?error=photo_failed`);
    }
  }

  revalidatePath(localizedPath(locale, '/properties'));
  redirect(localizedPath(locale, `/properties/${property.id}`));
}

export async function createPropertyDraftAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const name = value(formData, 'name');
  const rentalMode = value(formData, 'rental_mode') || 'shared_rooms';

  if (!name) {
    return {error: 'missing_name' as const};
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const planGate = await canCreateResource(supabase, workspaceId, 'properties');

  if (!planGate.allowed) {
    return {error: 'plan_limit' as const};
  }

  const {data: property, error} = await supabase
    .from('properties')
    .insert({
      address_line1: value(formData, 'address_line1') || null,
      city: value(formData, 'city') || null,
      country_code: 'FR',
      charges_estimate: null,
      deposit_estimate: null,
      monthly_rent_estimate: null,
      name,
      occupancy_status: 'vacant',
      postal_code: value(formData, 'postal_code') || null,
      property_type: value(formData, 'property_type') || 'apartment',
      rental_mode: rentalMode,
      surface_area: numericValue(formData, 'surface_area'),
      tax_regime: 'LMNP',
      workspace_id: workspaceId
    })
    .select('id')
    .single();

  if (error || !property) {
    return {error: 'create_failed' as const};
  }

  if (rentalMode === 'entire_place') {
    await supabase.from('units').insert({
      name: 'Logement entier',
      property_id: property.id,
      unit_type: 'apartment',
      workspace_id: workspaceId
    });
  }

  revalidatePath(localizedPath(locale, '/properties'));

  return {
    propertyId: property.id as string,
    workspaceId
  };
}

export async function updatePropertyAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const name = value(formData, 'name');
  const rentalMode = value(formData, 'rental_mode') || 'shared_rooms';
  const photos = imageFiles(formData);

  if (!propertyId || !name) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=missing_property`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  let existingPhotoCount = 0;
  if (photos.length) {
    const {data: billing} = await supabase.from('workspace_billing').select('plan').eq('workspace_id', workspaceId).maybeSingle();
    const photoLimit = getPropertyPhotoLimit(billing?.plan);
    const planLimits = getPlanLimits(billing?.plan);
    const {count} = await supabase
      .from('property_photos')
      .select('*', {count: 'exact', head: true})
      .eq('property_id', propertyId)
      .eq('workspace_id', workspaceId);
    existingPhotoCount = count ?? 0;

    if (existingPhotoCount + photos.length > photoLimit) {
      redirect(`${localizedPath(locale, `/properties/${propertyId}/edit`)}?error=photo_limit`);
    }

    if (hasOversizedFile(photos, planLimits.maxDocumentSizeBytes)) {
      redirect(`${localizedPath(locale, `/properties/${propertyId}/edit`)}?error=photo_size`);
    }
  }

  const {error} = await supabase
    .from('properties')
    .update({
      address_line1: value(formData, 'address_line1') || null,
      city: value(formData, 'city') || null,
      name,
      postal_code: value(formData, 'postal_code') || null,
      property_type: value(formData, 'property_type') || 'apartment',
      rental_mode: rentalMode,
      surface_area: numericValue(formData, 'surface_area')
    })
    .eq('id', propertyId)
    .eq('workspace_id', workspaceId);

  if (error) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=update_failed`);
  }

  if (photos.length) {
    const uploaded = await uploadPropertyPhotos({coverOffset: existingPhotoCount, files: photos, propertyId, supabase, workspaceId});

    if (!uploaded) {
      redirect(`${localizedPath(locale, `/properties/${propertyId}/edit`)}?error=photo_failed`);
    }
  }

  revalidatePath(localizedPath(locale, '/properties'));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}/edit`));
  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(localizedPath(locale, `/properties/${propertyId}`));
}

export async function deletePropertyPhotoAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const photoId = value(formData, 'photo_id');

  if (!propertyId || !photoId) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}/edit`)}?error=missing_photo`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: photo, error: photoError} = await supabase
    .from('property_photos')
    .select('file_path')
    .eq('id', photoId)
    .eq('property_id', propertyId)
    .eq('workspace_id', workspaceId)
    .single();

  if (photoError || !photo) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}/edit`)}?error=photo_not_found`);
  }

  const {error: deleteError} = await supabase.from('property_photos').delete().eq('id', photoId).eq('property_id', propertyId).eq('workspace_id', workspaceId);

  if (deleteError) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}/edit`)}?error=photo_delete_failed`);
  }

  await supabase.storage.from('property-photos').remove([photo.file_path]);

  revalidatePath(localizedPath(locale, '/properties'));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}/edit`));
  redirect(localizedPath(locale, `/properties/${propertyId}/edit`));
}

export async function terminateLeaseAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const leaseId = value(formData, 'lease_id');
  const endDate = value(formData, 'end_date');

  const returnTo = value(formData, 'return_to');
  const returnPath = (
    returnTo === 'bail' ? `/bail?property_id=${propertyId}` : returnTo === 'tenant_management' ? `/properties/${propertyId}/tenants` : `/properties/${propertyId}/edit`
  ) as `/${string}`;

  if (!propertyId || !leaseId || !endDate) {
    redirect(`${localizedPath(locale, returnPath)}?error=missing_termination`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {error} = await supabase
    .from('leases')
    .update({
      end_date: endDate,
      status: 'ended'
    })
    .eq('id', leaseId)
    .eq('property_id', propertyId)
    .eq('workspace_id', workspaceId);

  if (error) {
    redirect(`${localizedPath(locale, returnPath)}?error=termination_failed`);
  }

  const {count} = await supabase
    .from('leases')
    .select('*', {count: 'exact', head: true})
    .eq('property_id', propertyId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');

  if ((count ?? 0) === 0) {
    await supabase.from('properties').update({occupancy_status: 'vacant'}).eq('id', propertyId).eq('workspace_id', workspaceId);
  }

  revalidatePath(localizedPath(locale, '/properties'));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}/edit`));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}/tenants`));
  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(localizedPath(locale, returnPath));
}

export async function updateLeaseAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const leaseId = value(formData, 'lease_id');
  const startDate = value(formData, 'start_date');
  const endDate = value(formData, 'end_date');
  const monthlyRent = moneyValue(formData, 'monthly_rent');
  const chargesAmount = moneyValue(formData, 'charges_amount');
  const depositAmount = moneyValue(formData, 'deposit_amount');
  const returnPath = `/bail?property_id=${propertyId}` as `/${string}`;
  const returnUrl = localizedPath(locale, returnPath);
  const errorUrl = (code: string) => `${returnUrl}&error=${code}`;

  if (!propertyId || !leaseId || !startDate || monthlyRent <= 0) {
    redirect(errorUrl('lease_update_missing'));
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {error} = await supabase
    .from('leases')
    .update({
      charges_amount: chargesAmount,
      deposit_amount: depositAmount,
      end_date: endDate || null,
      monthly_rent: monthlyRent,
      start_date: startDate
    })
    .eq('id', leaseId)
    .eq('property_id', propertyId)
    .eq('workspace_id', workspaceId);

  if (error) {
    redirect(errorUrl('lease_update_failed'));
  }

  const {data: lockedCharges, error: lockedChargesError} = await supabase
    .from('rent_charges')
    .select('period_month')
    .eq('lease_id', leaseId)
    .eq('workspace_id', workspaceId)
    .neq('status', 'unpaid');

  if (lockedChargesError) {
    redirect(errorUrl('lease_charges_lookup_failed'));
  }

  const lockedPeriods = new Set((lockedCharges ?? []).map((charge: {period_month: string}) => charge.period_month));
  const {error: deleteChargesError} = await supabase.from('rent_charges').delete().eq('lease_id', leaseId).eq('workspace_id', workspaceId).eq('status', 'unpaid');

  if (deleteChargesError) {
    redirect(errorUrl('lease_charges_delete_failed'));
  }

  const rentCharges = buildRentChargesForLease({
    chargesAmount,
    endDate: endDate || null,
    leaseId,
    monthlyRent,
    startDate,
    workspaceId
  }).filter((charge) => !lockedPeriods.has(charge.period_month));

  if (rentCharges.length) {
    const {error: insertChargesError} = await supabase.from('rent_charges').insert(rentCharges);

    if (insertChargesError) {
      redirect(errorUrl('lease_charges_update_failed'));
    }
  }

  revalidatePath(localizedPath(locale, '/bail'));
  revalidatePath(localizedPath(locale, `/bail/${leaseId}`));
  revalidatePath(localizedPath(locale, '/properties'));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}/tenants`));
  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(returnUrl);
}

export async function assignPropertyTenantsAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const returnTo = value(formData, 'return_to');
  const tenantIds = values(formData, 'assignment_tenant_id');
  const startDates = values(formData, 'assignment_start_date');
  const endDates = values(formData, 'assignment_end_date');
  const monthlyRents = moneyValues(formData, 'assignment_monthly_rent');
  const chargesAmounts = moneyValues(formData, 'assignment_charges_amount');
  const depositAmounts = moneyValues(formData, 'assignment_deposit_amount');

  if (!propertyId) {
    redirect(`${localizedPath(locale, '/properties')}?error=missing_property`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: existingLeases} = await supabase
    .from('leases')
    .select('tenant_id')
    .eq('property_id', propertyId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active');
  const existingTenantIds = new Set((existingLeases ?? []).map((lease: {tenant_id: string}) => lease.tenant_id));

  for (let index = 0; index < tenantIds.length; index += 1) {
    const tenantId = tenantIds[index];
    const startDate = startDates[index];
    const monthlyRent = monthlyRents[index] ?? 0;
    const chargesAmount = chargesAmounts[index] ?? 0;
    const depositAmount = depositAmounts[index] ?? 0;

    if (!tenantId || !startDate || monthlyRent <= 0 || existingTenantIds.has(tenantId)) {
      continue;
    }

    const {data: lease, error: leaseError} = await supabase
      .from('leases')
      .insert({
        charges_amount: chargesAmount,
        deposit_amount: depositAmount,
        end_date: endDates[index] || null,
        monthly_rent: monthlyRent,
        property_id: propertyId,
        start_date: startDate,
        status: 'active',
        tenant_id: tenantId,
        unit_id: null,
        workspace_id: workspaceId
      })
      .select('id')
      .single();

    if (leaseError || !lease) {
      redirect(`${localizedPath(locale, `/properties/${propertyId}/tenants`)}?error=lease_failed`);
    }

    const rentCharges = buildRentChargesForLease({
      chargesAmount,
      endDate: endDates[index] || null,
      leaseId: lease.id,
      monthlyRent,
      startDate,
      workspaceId
    });

    if (rentCharges.length) {
      const {error: chargeError} = await supabase.from('rent_charges').insert(rentCharges);

      if (chargeError) {
        redirect(`${localizedPath(locale, `/properties/${propertyId}/tenants`)}?error=charges_failed`);
      }
    }
  }

  await supabase.from('properties').update({occupancy_status: 'rented'}).eq('id', propertyId).eq('workspace_id', workspaceId);

  revalidatePath(localizedPath(locale, '/properties'));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}/edit`));
  revalidatePath(localizedPath(locale, `/properties/${propertyId}/tenants`));
  revalidatePath(localizedPath(locale, '/tenants'));
  redirect(localizedPath(locale, returnTo === 'bail' ? `/bail?property_id=${propertyId}` : `/properties/${propertyId}/tenants`));
}

export async function deletePropertyAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');

  if (!propertyId) {
    redirect(`${localizedPath(locale, '/properties')}?error=missing_property`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: photos} = await supabase.from('property_photos').select('file_path').eq('property_id', propertyId).eq('workspace_id', workspaceId);
  const {error} = await supabase.from('properties').delete().eq('id', propertyId).eq('workspace_id', workspaceId);

  if (error) {
    redirect(`${localizedPath(locale, '/properties')}?error=delete_failed`);
  }

  const paths = (photos ?? []).map((photo: {file_path: string}) => photo.file_path);

  if (paths.length) {
    await supabase.storage.from('property-photos').remove(paths);
  }

  revalidatePath(localizedPath(locale, '/properties'));
  redirect(localizedPath(locale, '/properties'));
}

export async function createUnitAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const name = value(formData, 'name');
  const unitType = value(formData, 'unit_type') || 'room';

  if (!propertyId || !name) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=missing_unit`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {error} = await supabase.from('units').insert({
    name,
    property_id: propertyId,
    unit_type: unitType,
    workspace_id: workspaceId
  });

  if (error) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=unit_failed`);
  }

  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  redirect(localizedPath(locale, `/properties/${propertyId}`));
}

export async function createLeaseAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const tenantId = value(formData, 'tenant_id');
  const unitId = value(formData, 'unit_id');
  const startDate = value(formData, 'start_date');
  const endDate = value(formData, 'end_date');

  if (!propertyId || !tenantId || !startDate) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=missing_lease`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const chargesAmount = moneyValue(formData, 'charges_amount');
  const monthlyRent = moneyValue(formData, 'monthly_rent');
  const {data: lease, error} = await supabase
    .from('leases')
    .insert({
      charges_amount: chargesAmount,
      deposit_amount: moneyValue(formData, 'deposit_amount'),
      end_date: endDate || null,
      monthly_rent: monthlyRent,
      property_id: propertyId,
      start_date: startDate,
      status: 'active',
      tenant_id: tenantId,
      unit_id: unitId || null,
      workspace_id: workspaceId
    })
    .select('id')
    .single();

  if (error || !lease) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=lease_failed`);
  }

  const rentCharges = buildRentChargesForLease({
    chargesAmount,
    endDate: endDate || null,
    leaseId: lease.id,
    monthlyRent,
    startDate,
    workspaceId
  });

  if (rentCharges.length) {
    const {error: chargeError} = await supabase.from('rent_charges').insert(rentCharges);

    if (chargeError) {
      redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=charges_failed`);
    }
  }

  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  redirect(localizedPath(locale, `/properties/${propertyId}`));
}

export async function addRentPaymentAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const propertyId = value(formData, 'property_id');
  const rentChargeId = value(formData, 'rent_charge_id');
  const amount = moneyValue(formData, 'amount');
  const paidAt = value(formData, 'paid_at') || new Date().toISOString().slice(0, 10);
  const paymentMethod = value(formData, 'payment_method') || 'bank_transfer';

  if (!propertyId || !rentChargeId || amount <= 0) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=payment_missing`);
  }

  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const {data: charge, error: chargeError} = await supabase
    .from('rent_charges')
    .select('id, total_due')
    .eq('id', rentChargeId)
    .eq('workspace_id', workspaceId)
    .single();

  if (chargeError || !charge) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=charge_not_found`);
  }

  const {error: paymentError} = await supabase.from('rent_payments').insert({
    amount,
    paid_at: paidAt,
    payment_method: paymentMethod,
    rent_charge_id: rentChargeId,
    workspace_id: workspaceId
  });

  if (paymentError) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=payment_failed`);
  }

  const {data: payments, error: paymentsError} = await supabase
    .from('rent_payments')
    .select('amount')
    .eq('rent_charge_id', rentChargeId)
    .eq('workspace_id', workspaceId);

  if (paymentsError) {
    redirect(`${localizedPath(locale, `/properties/${propertyId}`)}?error=payment_status_failed`);
  }

  const paidTotal = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const totalDue = Number(charge.total_due);
  const status = paidTotal <= 0 ? 'unpaid' : paidTotal >= totalDue ? 'paid' : 'partial';

  await supabase.from('rent_charges').update({status}).eq('id', rentChargeId).eq('workspace_id', workspaceId);

  revalidatePath(localizedPath(locale, `/properties/${propertyId}`));
  revalidatePath(localizedPath(locale, '/dashboard'));
  redirect(localizedPath(locale, `/properties/${propertyId}`));
}
