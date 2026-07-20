import Stripe from 'stripe';

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Missing Stripe secret key.');
  }

  return new Stripe(secretKey);
}

export function getStripePriceId(plan: string, billingInterval: string = 'yearly') {
  const monthly = billingInterval === 'monthly';

  if (plan === 'portfolio') {
    return monthly ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PORTFOLIO_MONTHLY : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PORTFOLIO;
  }

  if (plan === 'plus') {
    return monthly ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS_MONTHLY : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS;
  }

  return monthly ? process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_SOLO_MONTHLY : process.env.NEXT_PUBLIC_STRIPE_PRICE_ID_SOLO;
}
