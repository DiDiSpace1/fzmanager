# Loyelio Billing Plans

This document is the product source of truth for Loyelio forfaits.

When this file changes, update the app code to match it, especially:

- `lib/billing/config.ts`
- `lib/billing/limits.ts`
- settings and pricing UI copy
- Stripe price ids and checkout metadata
- Supabase migrations if a new stored field is needed

## Product Positioning

The forfaits should not feel like "the same app with bigger numbers".

The intended product ladder is:

| Tier | Main promise | User feeling |
| --- | --- | --- |
| Free | Try the basic workflow | "I can test Loyelio." |
| Solo | Manage a small rental activity manually | "I have the essentials for a small landlord." |
| Plus | Save time with automation and better dashboards | "The app helps me follow up and generate documents faster." |
| Portfolio | Operate many tenants with batch management | "I can manage a portfolio without opening every tenant one by one." |

## Current Implemented Snapshot

These values are what the app currently enforces in code.

| Area | Free | Solo | Plus | Portfolio |
| --- | ---: | ---: | ---: | ---: |
| Properties | 1 | 5 | 10 | 20 |
| Tenants | 3 | 20 | 40 | 80 |
| Documents | 10 | 150 | 400 | 1000 |
| Storage limit | 50 MB | 500 MB | 1.5 GB | 4 GB |
| Max file size | 5 MB | 10 MB | 15 MB | 15 MB |
| Photos per property | 0 | 5 | 10 | 20 |

Notes:

- Paid access is granted when `workspace_billing.status` is `active` or `trialing`.
- The app stores the selected Stripe plan key in `workspace_billing.plan` as `solo`, `plus`, or `portfolio`.
- Legacy plan value `subscription` is treated as `solo`; legacy `lifetime` is treated as `portfolio`.
- Free plan users keep access to existing data but cannot use paid-only workflows.

## Feature Difference Matrix

This is the important part: higher forfaits should unlock stronger capabilities, not only bigger limits.

| Feature | Free | Solo | Plus | Portfolio |
| --- | --- | --- | --- | --- |
| Property management | 1 property | Up to 5 properties | Up to 10 properties | Up to 20 properties |
| Tenant management | Up to 3 tenants | Up to 20 tenants | Up to 40 tenants | Up to 80 tenants |
| Lease tracking | Basic | Included | Included | Included |
| Rent charge tracking | Basic | Included | Included | Included |
| Rent payment status | Basic | Included | Included | Included |
| Property photos | No | 5 per property | 10 per property | 20 per property |
| Document upload | 10 docs / 50 MB | 150 docs / 500 MB | 400 docs / 1.5 GB | 1000 docs / 4 GB |
| Quittance generation | No | Single manual generation | Single + batch generation | Single + batch + automatic generation after paid rent |
| Tax export | No | Basic export | Export with better dashboard context | Portfolio-scale export workflow |
| Dashboard | Basic dashboard | Basic dashboard | Professional Plus dashboard | Professional Portfolio dashboard |
| Rent reminders | No | No | Per-tenant / per-lease reminders | Per-tenant reminders + batch reminder center |
| Batch management | No | No | Limited batch workflows | Portfolio batch workflows |
| Priority support | No | Standard paid support | Priority support | Priority support |

## What Each Forfait Means

### Free

Purpose: allow users to test Loyelio.

Included:

- 1 property
- 3 tenants
- 10 documents
- basic property, tenant, lease and rent tracking

Not included:

- quittance generation
- tax export
- property photos
- rent reminders
- batch generation
- professional dashboard

Upgrade trigger:

- user wants to generate real documents
- user needs photos
- user reaches the property, tenant or document limit

### Solo

Purpose: small landlord managing a few rentals manually.

Included:

- 5 properties
- 20 tenants
- 150 documents
- 500 MB storage
- property photos
- single manual quittance generation
- basic tax export

Not included:

- batch quittance generation
- rent reminders
- professional dashboard
- batch tenant or reminder management

Product logic:

Solo is for users who are still comfortable doing things one by one.

Upgrade trigger:

- user repeats the same action for many tenants
- user wants automatic rent reminders
- user wants a more professional portfolio dashboard
- user wants batch quittance generation

### Plus

Purpose: growing landlord who wants time-saving workflows.

Included:

- 10 properties
- 40 tenants
- 400 documents
- 1.5 GB storage
- professional Plus dashboard
- batch quittance generation
- rent reminders per tenant / active lease
- higher photo and document limits

Current Plus-only / Plus-and-above capabilities:

- advanced dashboard replaces the basic dashboard
- batch quittance tab is available
- tenant list reminder switch is available
- tenant edit page can configure reminder day and reminder lead time

Product logic:

Plus should feel like "less repetitive work", not just "more units".

Upgrade trigger:

- user has several tenants and wants to avoid manual follow-up
- user generates multiple quittances every month
- user wants monthly visibility on rent, cash-flow, unpaid rents and portfolio performance

### Portfolio

Purpose: larger private portfolio requiring batch control and operational oversight.

Included:

- 20 properties
- 80 tenants
- 1000 documents
- 4 GB storage
- all Plus capabilities
- Portfolio-level batch-management direction

Currently implemented:

- Portfolio uses the advanced dashboard
- Portfolio can use batch quittance generation
- Portfolio can use rent reminders
- Portfolio has a reminder center for batch reminder management
- Portfolio can retry failed reminder sends from the reminder center
- Portfolio automatically generates a quittance when a rent month is marked as paid
- Portfolio can download successful batch-generated quittances as a ZIP archive
- Portfolio can batch-send generated quittances to tenants by email
- Portfolio has a task center for failed reminders, overdue rents, missing emails, expiring leases and missing receipts
- Portfolio has the highest limits

Planned Portfolio-only differentiation:

- none currently listed

Product logic:

Portfolio should feel like "control many tenants at once".

Upgrade trigger:

- user manages too many tenants to edit one by one
- user needs batch reminder and batch document operations
- user wants automation after marking rents as paid

## Receipt / Quittance Strategy

| Workflow | Free | Solo | Plus | Portfolio |
| --- | --- | --- | --- | --- |
| Generate quittance | No | Yes, manually one by one | Yes | Yes |
| Batch quittance generation | No | No | Yes | Yes |
| Automatic quittance after marking rent paid | No | No | No | Yes |

Recommended product language:

- Solo: "Generate receipts manually."
- Plus: "Generate several receipts at once."
- Portfolio: "Automate receipt generation after rent is marked as paid."

## Rent Reminder Strategy

| Workflow | Free | Solo | Plus | Portfolio |
| --- | --- | --- | --- | --- |
| See reminder feature | Locked upsell | Locked upsell | Included | Included |
| Toggle reminder on tenant list | Locked | Locked | Yes | Yes |
| Configure reminder day | No | No | Yes | Yes |
| Configure reminder lead time | No | No | Yes | Yes |
| Batch reminder center | No | No | No | Yes |
| Sending history | No | No | No | Yes |
| Failed reminder retry | No | No | No | Yes |

Current reminder settings are stored on `leases`:

- `rent_reminder_enabled`
- `rent_reminder_day`
- `rent_reminder_days_before`
- `last_rent_reminder_sent_at`

Implemented technical pieces:

- Vercel Cron route: `/api/cron/rent-reminders`
- daily schedule: `0 6 * * *`
- Resend email integration through `RESEND_KEY`
- sending log table: `rent_reminder_logs`
- duplicate-send protection per lease and month

Required production environment variables:

- `CRON_SECRET`
- `RESEND_KEY`
- `RENT_REMINDER_FROM_EMAIL`

Implemented Portfolio reminder center:

- batch enable / disable rent reminders
- bulk reminder date editing
- bulk reminder lead-time editing
- sending history display
- missing-email and failed-send counters
- failed reminder retry UI

## Dashboard Strategy

| Dashboard | Free | Solo | Plus | Portfolio |
| --- | --- | --- | --- | --- |
| Basic dashboard | Yes | Yes | No | No |
| Professional dashboard | No | No | Yes | Yes |

The Plus / Portfolio dashboard should focus on:

- collected rent
- net cash-flow
- late rent
- occupancy
- leases to watch
- monthly trend
- property performance
- priority alerts
- recommended actions

This gives Plus and Portfolio a visible daily value, even before the user hits numerical limits.

## Stripe Mapping

| App plan key | Stripe mode | Stripe price env var | Meaning |
| --- | --- | --- | --- |
| `free` | None | None | Default workspace plan |
| `solo` yearly | subscription | `NEXT_PUBLIC_STRIPE_PRICE_ID_SOLO` | Solo yearly subscription |
| `solo` monthly | subscription | `NEXT_PUBLIC_STRIPE_PRICE_ID_SOLO_MONTHLY` | Solo monthly subscription |
| `plus` yearly | subscription | `NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS` | Plus yearly subscription |
| `plus` monthly | subscription | `NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS_MONTHLY` | Plus monthly subscription |
| `portfolio` yearly | subscription | `NEXT_PUBLIC_STRIPE_PRICE_ID_PORTFOLIO` | Portfolio yearly subscription |
| `portfolio` monthly | subscription | `NEXT_PUBLIC_STRIPE_PRICE_ID_PORTFOLIO_MONTHLY` | Portfolio monthly subscription |
| `custom` | Manual | TBD | Future contact-us tier |

## Implementation Checklist For Future Changes

When applying edits from this document to the app:

1. Update limits and fallback behavior in `lib/billing/config.ts`.
2. Update resource checks in `lib/billing/limits.ts` if new resources become limited.
3. Update pricing/settings UI copy and visible tier names.
4. Update Stripe checkout plan keys, metadata, and env vars if tier keys change.
5. Add a Supabase migration if the database needs new plan fields.
6. Run `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm smoke:prod` when applicable.
