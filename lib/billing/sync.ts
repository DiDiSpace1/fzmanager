import type Stripe from 'stripe';

import {createSupabaseAdminClient} from '@/lib/supabase/admin';

import {getStripe} from './stripe';

const planPriceEnv = {
  portfolio: {
    monthly: 'NEXT_PUBLIC_STRIPE_PRICE_ID_PORTFOLIO_MONTHLY',
    yearly: 'NEXT_PUBLIC_STRIPE_PRICE_ID_PORTFOLIO'
  },
  plus: {
    monthly: 'NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS_MONTHLY',
    yearly: 'NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS'
  },
  solo: {
    monthly: 'NEXT_PUBLIC_STRIPE_PRICE_ID_SOLO_MONTHLY',
    yearly: 'NEXT_PUBLIC_STRIPE_PRICE_ID_SOLO'
  }
} as const;

type PlanKey = keyof typeof planPriceEnv;
type BillingInterval = keyof (typeof planPriceEnv)['solo'];

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const value = (subscription as Stripe.Subscription & {current_period_end?: number}).current_period_end;
  return value ? new Date(value * 1000).toISOString() : null;
}

function pricePlan(priceId: string | null | undefined) {
  if (!priceId) {
    return null;
  }

  for (const [plan, intervals] of Object.entries(planPriceEnv) as Array<[PlanKey, Record<BillingInterval, string>]>) {
    for (const [interval, envName] of Object.entries(intervals) as Array<[BillingInterval, string]>) {
      if (process.env[envName] === priceId) {
        return {interval, plan};
      }
    }
  }

  return null;
}

function metadataPlan(metadata: Stripe.Metadata | null | undefined) {
  const plan = metadata?.plan;
  const billingInterval = metadata?.billing_interval;

  if (!plan || !['solo', 'plus', 'portfolio'].includes(plan)) {
    return null;
  }

  return {
    interval: billingInterval === 'monthly' ? 'monthly' : 'yearly',
    plan: plan as PlanKey
  };
}

export function subscriptionPlan(subscription: Stripe.Subscription) {
  const currentItem = subscription.items.data[0];
  return pricePlan(currentItem?.price.id) ?? metadataPlan(subscription.metadata) ?? {interval: 'yearly' as const, plan: 'solo' as const};
}

export async function syncWorkspaceBillingFromStripe(workspaceId: string, subscriptionId: string) {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['schedule']
  });
  const current = subscriptionPlan(subscription);
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const admin = createSupabaseAdminClient();

  await admin.from('workspace_billing').upsert(
    {
      current_period_end: subscriptionPeriodEnd(subscription),
      lifetime_access: false,
      plan: current.plan,
      status: subscription.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      workspace_id: workspaceId
    },
    {onConflict: 'workspace_id'}
  );

  return subscription;
}

export async function pendingPlanFromSchedule(subscription: Stripe.Subscription) {
  const scheduleValue = subscription.schedule;
  const scheduleId = typeof scheduleValue === 'string' ? scheduleValue : scheduleValue?.id;

  if (!scheduleId) {
    return null;
  }

  const stripe = getStripe();
  const schedule = typeof scheduleValue === 'string' ? await stripe.subscriptionSchedules.retrieve(scheduleId) : scheduleValue;

  if (!schedule) {
    return null;
  }

  const periodEnd = (subscription as Stripe.Subscription & {current_period_end?: number}).current_period_end;
  const futurePhase = schedule.phases.find((phase) => phase.start_date && periodEnd && phase.start_date >= periodEnd);
  const futurePrice = futurePhase?.items[0]?.price;
  const futurePriceId = typeof futurePrice === 'string' ? futurePrice : futurePrice?.id;

  return pricePlan(futurePriceId);
}
