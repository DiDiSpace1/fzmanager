# Vercel Launch Checklist

## Environment

Set these variables in Vercel for Production and Preview:

```text
NEXT_PUBLIC_APP_URL=https://your-domain.example
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY=
NEXT_PUBLIC_STRIPE_PRICE_ID_LIFETIME=
```

Use the deployed URL for previews if you test Stripe Checkout on a preview deployment.

## Supabase

- Run all migrations through `20260707160000_workspace_billing.sql`.
- Confirm the `documents` storage bucket exists.
- Add production auth redirect URLs:
  - `https://your-domain.example/auth/callback`
  - `https://your-domain.example/reset-password`
  - `https://your-domain.example/en/auth/callback`
  - `https://your-domain.example/en/reset-password`
  - `https://your-domain.example/zh/auth/callback`
  - `https://your-domain.example/zh/reset-password`
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.

## Stripe

- Create the recurring subscription Price (monthly or yearly) and lifetime one-time Price.
- Copy both Price IDs into Vercel.
- Add a webhook endpoint:
  - URL: `https://your-domain.example/api/stripe/webhook`
  - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
- Enable Customer Portal in Stripe Dashboard before launch.

## Product Smoke Test

- Sign up and confirm a new workspace is created.
- Create 1 property, 3 tenants, and 10 documents on the free plan.
- Confirm the next property, tenant, or document redirects with `plan_limit`.
- Buy Pro in Stripe test mode and confirm the settings page shows Pro after webhook delivery.
- Open Stripe Customer Portal from settings.
- Cancel the subscription and confirm limits return after the webhook updates billing.
- Visit `/privacy` and `/terms` while logged out.
- Confirm a free user sees the Pro prompt on `/tax` and cannot download `/api/tax/export.zip` directly.
- Confirm a paid user can download the CSV and ZIP tax preparation package.
- Confirm password reset email opens `/reset-password` and updates the password.
- Confirm account deletion cancels an active Stripe subscription before deleting the user.

## Build

Run locally before deploy:

```bash
pnpm lint
pnpm typecheck
pnpm build
```
