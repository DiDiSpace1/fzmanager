'use server';

import type Stripe from 'stripe';
import {redirect} from 'next/navigation';

import {getAppUrl, hasPaidAccess} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {subscriptionPlan, syncWorkspaceBillingFromStripe, syncWorkspaceBillingFromStripeCustomer} from '@/lib/billing/sync';
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

function subscriptionTimestamp(subscription: Stripe.Subscription, key: 'current_period_end') {
  return (subscription as Stripe.Subscription & Record<typeof key, number | undefined>)[key];
}

function appendParams(path: string, params: Record<string, string>) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${new URLSearchParams(params).toString()}`;
}

function billingDebugId() {
  return `bill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function stripeErrorDetails(error: unknown) {
  if (error && typeof error === 'object') {
    const stripeError = error as Stripe.StripeRawError & {
      code?: string;
      decline_code?: string;
      param?: string;
      raw?: Stripe.StripeRawError;
      requestId?: string;
      statusCode?: number;
      type?: string;
    };

    return {
      code: stripeError.code,
      declineCode: stripeError.decline_code,
      message: stripeError.message,
      param: stripeError.param,
      raw: stripeError.raw
        ? {
            code: stripeError.raw.code,
            message: stripeError.raw.message,
            param: stripeError.raw.param,
            type: stripeError.raw.type
          }
        : undefined,
      requestId: stripeError.requestId,
      statusCode: stripeError.statusCode,
      type: stripeError.type
    };
  }

  return {message: String(error)};
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
  const admin = createSupabaseAdminClient();
  let billing = await getWorkspaceBilling(admin, workspaceId);
  const debugId = billingDebugId();

  try {
    if (customerId) {
      await syncWorkspaceBillingFromStripeCustomer(workspaceId, customerId);
    } else if (billing?.stripe_subscription_id) {
      await syncWorkspaceBillingFromStripe(workspaceId, billing.stripe_subscription_id);
    }

    billing = await getWorkspaceBilling(admin, workspaceId);
  } catch (error) {
    console.error('Stripe billing sync before checkout failed', {
      debugId,
      details: stripeErrorDetails(error),
      stage: 'sync_before_checkout',
      workspaceId
    });
  }

  if (billing?.stripe_subscription_id && hasPaidAccess(billing)) {
    let scheduledAt;

    try {
      scheduledAt = await scheduleSubscriptionChange({
        billingInterval,
        locale,
        plan,
        priceId,
        returnPath: safeReturnPath,
        subscriptionId: billing.stripe_subscription_id,
        workspaceId
      });
    } catch (error) {
      console.error('Stripe subscription schedule failed', {
        debugId,
        details: stripeErrorDetails(error),
        plan,
        priceId,
        stage: 'schedule_subscription_change',
        subscriptionId: billing.stripe_subscription_id,
        workspaceId
      });
      redirect(appendParams(safeReturnPath, {debug: debugId, error: 'plan_change_failed'}));
    }

    redirect(appendParams(safeReturnPath, {checkout: 'scheduled', scheduled_at: String(scheduledAt), scheduled_plan: plan}));
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
    console.error('Stripe checkout session failed', {
      debugId,
      details: stripeErrorDetails(error),
      plan,
      priceId,
      stage: 'create_checkout_session',
      workspaceId
    });
    redirect(appendParams(safeReturnPath, {debug: debugId, error: 'checkout_failed'}));
  }

  if (!session.url) {
    console.error('Stripe checkout session returned no url', {
      debugId,
      plan,
      priceId,
      stage: 'checkout_session_missing_url',
      workspaceId
    });
    redirect(appendParams(safeReturnPath, {debug: debugId, error: 'checkout_failed'}));
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
  const periodEnd = subscriptionTimestamp(subscription, 'current_period_end');
  const currentItem = subscription.items.data[0];

  if (!periodEnd || !currentItem) {
    throw new Error('Subscription has no current period or item.');
  }

  const current = subscriptionPlan(subscription);
  const scheduleValue = subscription.schedule;
  const scheduleId = typeof scheduleValue === 'string' ? scheduleValue : scheduleValue?.id;
  let schedule: Stripe.SubscriptionSchedule;

  try {
    schedule = scheduleId ? await stripe.subscriptionSchedules.retrieve(scheduleId) : await stripe.subscriptionSchedules.create({from_subscription: subscription.id});
  } catch (error) {
    console.error('Stripe subscription schedule retrieve/create failed', {
      details: stripeErrorDetails(error),
      existingScheduleId: scheduleId,
      stage: 'retrieve_or_create_schedule',
      subscriptionId: subscription.id,
      workspaceId
    });
    throw error;
  }

  console.info('Stripe subscription schedule change requested', {
    billingInterval,
    currentPlan: current.plan,
    currentPriceId: currentItem.price.id,
    periodEnd,
    plan,
    priceId,
    scheduleId: schedule.id,
    subscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    workspaceId
  });

  await updateSubscriptionSchedule({
    billingInterval,
    currentInterval: current.interval,
    currentPlan: current.plan,
    periodEnd,
    plan,
    priceId,
    schedule,
    subscriptionItem: currentItem,
    workspaceId
  }).catch(async (error) => {
    if (!scheduleId) {
      throw error;
    }

    console.error('Stripe subscription schedule update failed, recreating schedule', {
      details: stripeErrorDetails(error),
      scheduleId,
      stage: 'recreate_schedule_after_update_failure',
      subscriptionId: subscription.id,
      workspaceId
    });

    try {
      await stripe.subscriptionSchedules.release(scheduleId);
    } catch (releaseError) {
      console.error('Stripe subscription schedule release failed', {
        details: stripeErrorDetails(releaseError),
        scheduleId,
        stage: 'release_existing_schedule',
        subscriptionId: subscription.id,
        workspaceId
      });
      throw releaseError;
    }

    let nextSchedule: Stripe.SubscriptionSchedule;

    try {
      nextSchedule = await stripe.subscriptionSchedules.create({from_subscription: subscription.id});
    } catch (createError) {
      console.error('Stripe subscription schedule recreate failed', {
        details: stripeErrorDetails(createError),
        stage: 'recreate_schedule',
        subscriptionId: subscription.id,
        workspaceId
      });
      throw createError;
    }

    await updateSubscriptionSchedule({
      billingInterval,
      currentInterval: current.interval,
      currentPlan: current.plan,
      periodEnd,
      plan,
      priceId,
      schedule: nextSchedule,
      subscriptionItem: currentItem,
      workspaceId
    });
  });

  return periodEnd;
}

async function updateSubscriptionSchedule({
  billingInterval,
  currentInterval,
  currentPlan,
  periodEnd,
  plan,
  priceId,
  schedule,
  subscriptionItem,
  workspaceId
}: {
  billingInterval: string;
  currentInterval: string;
  currentPlan: string;
  periodEnd: number;
  plan: string;
  priceId: string;
  schedule: Stripe.SubscriptionSchedule;
  subscriptionItem: Stripe.SubscriptionItem;
  workspaceId: string;
}) {
  const stripe = getStripe();
  const currentPhase = schedule.current_phase ?? schedule.phases.find((phase) => phase.start_date <= periodEnd && phase.end_date >= periodEnd);
  const currentPhaseStart = currentPhase?.start_date ?? schedule.phases[0]?.start_date;
  const currentQuantity = subscriptionItem.quantity ?? 1;

  if (!currentPhaseStart) {
    throw new Error('Subscription schedule has no current phase start date.');
  }

  const updateParams = (startDate: number | 'now'): Stripe.SubscriptionScheduleUpdateParams => ({
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
            price: subscriptionItem.price.id,
            quantity: currentQuantity
          }
        ],
        metadata: {
          billing_interval: currentInterval,
          plan: currentPlan,
          workspace_id: workspaceId
        },
        start_date: startDate
      },
      {
        items: [
          {
            price: priceId,
            quantity: currentQuantity
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

  try {
    await stripe.subscriptionSchedules.update(schedule.id, updateParams(currentPhaseStart));
  } catch (error) {
    console.error('Stripe subscription schedule update with current phase start failed, retrying from now', {
      currentPhaseStart,
      details: stripeErrorDetails(error),
      periodEnd,
      scheduleId: schedule.id,
      stage: 'update_schedule_current_start',
      workspaceId
    });

    try {
      await stripe.subscriptionSchedules.update(schedule.id, updateParams('now'));
    } catch (retryError) {
      console.error('Stripe subscription schedule update from now failed', {
        details: stripeErrorDetails(retryError),
        periodEnd,
        scheduleId: schedule.id,
        stage: 'update_schedule_now',
        workspaceId
      });
      throw retryError;
    }
  }
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
