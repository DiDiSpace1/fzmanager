import type Stripe from 'stripe';
import {NextResponse} from 'next/server';

import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {getStripe} from '@/lib/billing/stripe';
import {subscriptionPlan} from '@/lib/billing/sync';

export const runtime = 'nodejs';

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const value = (subscription as Stripe.Subscription & {current_period_end?: number}).current_period_end;
  return value ? new Date(value * 1000).toISOString() : null;
}

function planValue(plan: string | null | undefined) {
  return ['solo', 'plus', 'portfolio'].includes(plan ?? '') ? plan : 'solo';
}

async function updateBillingByWorkspace(workspaceId: string, values: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();

  await supabase.from('workspace_billing').upsert(
    {
      ...values,
      workspace_id: workspaceId
    },
    {onConflict: 'workspace_id'}
  );
}

async function updateBillingByCustomer(customerId: string, values: Record<string, unknown>) {
  const supabase = createSupabaseAdminClient();

  await supabase.from('workspace_billing').update(values).eq('stripe_customer_id', customerId);
}

async function getBillingByCustomer(customerId: string) {
  const supabase = createSupabaseAdminClient();
  const {data} = await supabase
    .from('workspace_billing')
    .select('stripe_subscription_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle<{stripe_subscription_id: string | null}>();

  return data ?? null;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const workspaceId = session.metadata?.workspace_id;

  if (!workspaceId || !session.customer) {
    return;
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer.id;

  if (session.mode === 'payment' && session.payment_status === 'paid') {
    await updateBillingByWorkspace(workspaceId, {
      lifetime_access: true,
      plan: 'lifetime',
      status: 'active',
      stripe_customer_id: customerId,
      stripe_subscription_id: null
    });
  } else {
    await updateBillingByWorkspace(workspaceId, {
      plan: planValue(session.metadata?.plan),
      stripe_customer_id: customerId
    });
  }
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const workspaceId = subscription.metadata?.workspace_id;
  const currentPlan = subscriptionPlan(subscription);
  const values = {
    current_period_end: subscriptionPeriodEnd(subscription),
    lifetime_access: false,
    plan: currentPlan.plan,
    status: subscription.status,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id
  };

  if (workspaceId) {
    await updateBillingByWorkspace(workspaceId, values);
    return;
  }

  await updateBillingByCustomer(customerId, values);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const billing = await getBillingByCustomer(customerId);

  if (billing?.stripe_subscription_id !== subscription.id) {
    return;
  }

  await updateBillingByCustomer(customerId, {
    current_period_end: subscriptionPeriodEnd(subscription),
    plan: 'free',
    status: 'canceled',
    stripe_subscription_id: subscription.id
  });
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({error: 'Missing Stripe webhook secret.'}, {status: 500});
  }

  const stripe = getStripe();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({error: 'Missing Stripe signature.'}, {status: 400});
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({error: 'Invalid Stripe webhook signature.'}, {status: 400});
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionChanged(event.data.object);
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event.data.object);
      break;
    default:
      break;
  }

  return NextResponse.json({received: true});
}
