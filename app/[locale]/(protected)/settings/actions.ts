'use server';

import type Stripe from 'stripe';
import {redirect} from 'next/navigation';

import {getAppUrl, hasPaidAccess} from '@/lib/billing/config';
import {getWorkspaceBilling} from '@/lib/billing/limits';
import {syncWorkspaceBillingFromStripe, syncWorkspaceBillingFromStripeCustomer} from '@/lib/billing/sync';
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

function subscriptionPeriodEndTimestamp(subscription: Stripe.Subscription) {
  const subscriptionPeriodEnd = (subscription as Stripe.Subscription & {current_period_end?: number}).current_period_end;
  const itemPeriodEnd = (subscription.items.data[0] as Stripe.SubscriptionItem & {current_period_end?: number} | undefined)?.current_period_end;
  return subscriptionPeriodEnd ?? itemPeriodEnd ?? null;
}

function subscriptionCustomerId(subscription: Stripe.Subscription) {
  return typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
}

function subscriptionPaymentMethodId(subscription: Stripe.Subscription) {
  const paymentMethod = subscription.default_payment_method;
  return typeof paymentMethod === 'string' ? paymentMethod : paymentMethod?.id;
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

function passwordSettingsHref(locale: string, params: Record<string, string>) {
  return appendParams(localizedPath(locale, '/settings?tab=securite'), params);
}

function hasStrongPassword(value: string) {
  return value.length >= 12 && /[A-Z]/.test(value) && /\d/.test(value);
}

export async function updatePasswordAction(formData: FormData) {
  const locale = value(formData, 'locale') || 'fr';
  const oldPassword = value(formData, 'old_password');
  const newPassword = value(formData, 'new_password');
  const confirmPassword = value(formData, 'confirm_password');

  if (!oldPassword || !newPassword || !confirmPassword) {
    redirect(passwordSettingsHref(locale, {error: 'password_missing'}));
  }

  if (newPassword !== confirmPassword) {
    redirect(passwordSettingsHref(locale, {error: 'password_mismatch'}));
  }

  if (!hasStrongPassword(newPassword)) {
    redirect(passwordSettingsHref(locale, {error: 'password_strength'}));
  }

  const {supabase, user} = await getCurrentUserWorkspace(locale);
  const email = user.email;

  if (!email) {
    redirect(passwordSettingsHref(locale, {error: 'password_update_failed'}));
  }

  const {error: signInError} = await supabase.auth.signInWithPassword({
    email,
    password: oldPassword
  });

  if (signInError) {
    redirect(passwordSettingsHref(locale, {error: 'password_invalid_current'}));
  }

  const {error} = await supabase.auth.updateUser({
    password: newPassword
  });

  if (error) {
    redirect(passwordSettingsHref(locale, {error: 'password_update_failed'}));
  }

  redirect(passwordSettingsHref(locale, {saved: 'password'}));
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
  const periodEnd = subscriptionPeriodEndTimestamp(subscription);
  const currentItem = subscription.items.data[0];

  if (!currentItem) {
    throw new Error('Subscription has no subscription item.');
  }

  if (!periodEnd) {
    throw new Error('Subscription has no current period end.');
  }

  const customerId = subscriptionCustomerId(subscription);
  const currentQuantity = currentItem.quantity ?? 1;
  const paymentMethodId = subscriptionPaymentMethodId(subscription);

  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 100,
      status: 'all'
    });
    const existingPendingSubscriptions = subscriptions.data.filter(
      (candidate) =>
        candidate.id !== subscription.id &&
        candidate.metadata?.pending_replacement === 'true' &&
        candidate.metadata?.replaces_subscription_id === subscription.id &&
        ['incomplete', 'past_due', 'trialing'].includes(candidate.status)
    );

    await Promise.all(existingPendingSubscriptions.map((candidate) => stripe.subscriptions.cancel(candidate.id)));
  } catch (error) {
    console.error('Stripe pending replacement cleanup failed', {
      details: stripeErrorDetails(error),
      stage: 'cleanup_pending_replacement_subscriptions',
      subscriptionId: subscription.id,
      workspaceId
    });
    throw error;
  }

  try {
    const pendingSubscription = await stripe.subscriptions.create({
      customer: customerId,
      ...(paymentMethodId ? {default_payment_method: paymentMethodId} : {}),
      items: [
        {
          price: priceId,
          quantity: currentQuantity
        }
      ],
      metadata: {
        billing_interval: billingInterval,
        pending_billing_interval: billingInterval,
        pending_plan: plan,
        pending_replacement: 'true',
        plan,
        replaces_subscription_id: subscription.id,
        workspace_id: workspaceId
      },
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      trial_end: periodEnd,
      trial_settings: {
        end_behavior: {
          missing_payment_method: 'cancel'
        }
      }
    });

    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
      metadata: {
        pending_billing_interval: billingInterval,
        pending_plan: plan,
        pending_replacement_subscription_id: pendingSubscription.id,
        workspace_id: workspaceId
      }
    });

    console.info('Stripe subscription replacement scheduled', {
      billingInterval,
      currentPriceId: currentItem.price.id,
      pendingSubscriptionId: pendingSubscription.id,
      periodEnd,
      plan,
      priceId,
      subscriptionId: subscription.id,
      workspaceId
    });
  } catch (error) {
    console.error('Stripe subscription replacement scheduling failed', {
      details: stripeErrorDetails(error),
      periodEnd,
      plan,
      priceId,
      stage: 'schedule_replacement_subscription',
      subscriptionId: subscription.id,
      workspaceId
    });
    throw error;
  }

  return periodEnd;
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
