'use server';

import type Stripe from 'stripe';
import {redirect} from 'next/navigation';

import {getAppUrl, hasPaidAccess} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {subscriptionPlan, syncWorkspaceBillingFromStripe} from '@/lib/billing/sync';
import {getStripe, getStripePriceId} from '@/lib/billing/stripe';
import {localizedPath} from '@/lib/navigation';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getCurrentUserWorkspace} from '@/lib/workspace';

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === 'string' ? raw.trim() : '';
}

function planValue(formData: FormData) {
  const plan = value(formData, 'plan');
  return ['solo', 'plus', 'portfolio'].includes(plan) ? plan : 'solo';
}

function billingIntervalValue(formData: FormData) {
  return value(formData, 'billing_interval') === 'monthly' ? 'monthly' : 'yearly';
}

function subscriptionTimestamp(subscription: Stripe.Subscription, key: 'current_period_end' | 'current_period_start') {
  return (subscription as Stripe.Subscription & Record<typeof key, number | undefined>)[key];
}

export async function updateAccountSettingsAction(formData: FormData) {
  const currentLocale = value(formData, 'current_locale') || 'fr';
  const nextLocale = ['fr', 'en', 'zh'].includes(value(formData, 'locale')) ? value(formData, 'locale') : currentLocale;
  const countryCode = value(formData, 'country_code') === 'FR' ? 'FR' : 'FR';
  const fullName = value(formData, 'full_name');
  const taxRegime = value(formData, 'tax_regime') === 'LMNP' ? 'LMNP' : 'LMNP';
  const {supabase, user, workspaceId} = await getCurrentUserWorkspace(currentLocale);

  const {error: profileError} = await supabase
    .from('profiles')
    .update({
      country_code: countryCode,
      full_name: fullName || null,
      locale: nextLocale
    })
    .eq('id', user.id);

  const {error: workspaceError} = await supabase
    .from('workspaces')
    .update({
      country_code: countryCode,
      tax_regime: taxRegime
    })
    .eq('id', workspaceId);

  if (profileError || workspaceError) {
    redirect(`${localizedPath(currentLocale, '/settings')}?error=settings_failed`);
  }

  redirect(`${localizedPath(nextLocale, '/settings')}?saved=settings`);
}

async function ensureStripeCustomer(locale: string) {
  const {profile, supabase, user, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);
  const stripe = getStripe();

  if (billing?.stripe_customer_id) {
    try {
      const customer = await stripe.customers.retrieve(billing.stripe_customer_id);

      if (!customer.deleted) {
        return {
          customerId: billing.stripe_customer_id,
          user,
          workspaceId
        };
      }
    } catch {
      // The stored customer may belong to another Stripe mode/account. Create a fresh one below.
    }
  }

  const customer = await stripe.customers.create({
    email: user.email ?? profile.email ?? undefined,
    metadata: {
      user_id: user.id,
      workspace_id: workspaceId
    }
  });

  const admin = createSupabaseAdminClient();
  await admin.from('workspace_billing').upsert(
    {
      stripe_customer_id: customer.id,
      workspace_id: workspaceId
    },
    {onConflict: 'workspace_id'}
  );

  return {
    customerId: customer.id,
    user,
    workspaceId
  };
}

export async function createCheckoutSessionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const plan = planValue(formData);
  const billingInterval = billingIntervalValue(formData);
  const returnPath = value(formData, 'return_path');
  const safeReturnPath = returnPath.startsWith('/') && !returnPath.startsWith('//') ? returnPath : localizedPath(locale, '/settings');
  const priceId = getStripePriceId(plan, billingInterval);

  if (!priceId) {
    redirect(`${safeReturnPath}?error=stripe_price_missing`);
  }

  const {customerId, user, workspaceId} = await ensureStripeCustomer(locale);
  const stripe = getStripe();
  const appUrl = getAppUrl();
  const returnUrl = `${appUrl}${safeReturnPath}`;
  const billing = await getWorkspaceBilling(createSupabaseAdminClient(), workspaceId);

  if (billing?.stripe_subscription_id && hasPaidAccess(billing)) {
    try {
      await scheduleSubscriptionChange({
        billingInterval,
        locale,
        plan,
        priceId,
        returnPath: safeReturnPath,
        subscriptionId: billing.stripe_subscription_id,
        workspaceId
      });
    } catch (error) {
      console.error('Stripe subscription schedule failed', error);
      redirect(`${safeReturnPath}${safeReturnPath.includes('?') ? '&' : '?'}error=checkout_failed`);
    }

    redirect(`${safeReturnPath}${safeReturnPath.includes('?') ? '&' : '?'}checkout=scheduled`);
  }

  let session;

  try {
    session = await stripe.checkout.sessions.create({
      cancel_url: `${returnUrl}${safeReturnPath.includes('?') ? '&' : '?'}checkout=cancelled`,
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        billing_interval: billingInterval,
        plan,
        user_id: user.id,
        workspace_id: workspaceId
      },
      mode: 'subscription',
      subscription_data: {
        metadata: {
          billing_interval: billingInterval,
          plan,
          workspace_id: workspaceId
        }
      },
      success_url: `${returnUrl}${safeReturnPath.includes('?') ? '&' : '?'}checkout=success`
    });
  } catch (error) {
    console.error('Stripe checkout session failed', error);
    redirect(`${safeReturnPath}${safeReturnPath.includes('?') ? '&' : '?'}error=checkout_failed`);
  }

  if (!session.url) {
    redirect(`${safeReturnPath}${safeReturnPath.includes('?') ? '&' : '?'}error=checkout_failed`);
  }

  redirect(session.url);
}

async function scheduleSubscriptionChange({
  billingInterval,
  plan,
  priceId,
  subscriptionId,
  workspaceId
}: {
  billingInterval: string;
  locale: string;
  plan: string;
  priceId: string;
  returnPath: string;
  subscriptionId: string;
  workspaceId: string;
}) {
  const stripe = getStripe();
  const subscription = await syncWorkspaceBillingFromStripe(workspaceId, subscriptionId);
  const periodStart = subscriptionTimestamp(subscription, 'current_period_start');
  const periodEnd = subscriptionTimestamp(subscription, 'current_period_end');
  const currentItem = subscription.items.data[0];

  if (!periodStart || !periodEnd || !currentItem) {
    throw new Error('Subscription has no current period or item.');
  }

  const current = subscriptionPlan(subscription);
  const scheduleValue = subscription.schedule;
  const scheduleId = typeof scheduleValue === 'string' ? scheduleValue : scheduleValue?.id;
  const schedule = scheduleId ? await stripe.subscriptionSchedules.retrieve(scheduleId) : await stripe.subscriptionSchedules.create({from_subscription: subscription.id});

  await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: 'release',
    metadata: {
      pending_billing_interval: billingInterval,
      pending_plan: plan,
      workspace_id: workspaceId
    },
    phases: [
      {
        end_date: periodEnd,
        items: [
          {
            price: currentItem.price.id,
            quantity: currentItem.quantity ?? 1
          }
        ],
        metadata: {
          billing_interval: current.interval,
          plan: current.plan,
          workspace_id: workspaceId
        },
        start_date: periodStart
      },
      {
        items: [
          {
            price: priceId,
            quantity: currentItem.quantity ?? 1
          }
        ],
        metadata: {
          billing_interval: billingInterval,
          plan,
          workspace_id: workspaceId
        },
        proration_behavior: 'none',
        start_date: periodEnd
      }
    ],
    proration_behavior: 'none'
  });
}

export async function createBillingPortalSessionAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const {supabase, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (!billing?.stripe_customer_id) {
    redirect(`${localizedPath(locale, '/settings')}?error=billing_customer_missing`);
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripe_customer_id,
    return_url: `${getAppUrl()}${localizedPath(locale, '/settings')}`
  });

  redirect(session.url);
}

export async function deleteAccountAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const confirmation = value(formData, 'confirmation');

  if (confirmation !== 'SUPPRIMER') {
    redirect(`${localizedPath(locale, '/settings')}?error=delete_confirmation`);
  }

  const {supabase, user, workspaceId} = await getCurrentUserWorkspace(locale);
  const billing = await getWorkspaceBilling(supabase, workspaceId);

  if (billing?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(billing.status)) {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(billing.stripe_subscription_id);
  }

  const {data: documents} = await supabase.from('documents').select('file_path').eq('workspace_id', workspaceId);
  const filePaths = (documents ?? [])
    .map((document) => document.file_path)
    .filter((filePath): filePath is string => typeof filePath === 'string' && filePath.length > 0);

  if (filePaths.length) {
    await supabase.storage.from('documents').remove(filePaths);
  }

  const admin = createSupabaseAdminClient();
  await admin
    .from('workspace_billing')
    .update({
      current_period_end: null,
      plan: 'free',
      status: 'canceled',
      stripe_subscription_id: null
    })
    .eq('workspace_id', workspaceId);

  const {error} = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    redirect(`${localizedPath(locale, '/settings')}?error=delete_failed`);
  }

  redirect(localizedPath(locale, '/'));
}
