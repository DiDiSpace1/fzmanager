# Loyelio Billing Plans

This document is the product source of truth for membership tiers and feature limits.

When this file changes, update the app code to match it, especially:

- `lib/billing/config.ts`
- `lib/billing/limits.ts`
- settings and pricing UI copy
- Stripe price ids and checkout metadata
- Supabase migrations if a new stored field is needed

## Current implementation snapshot

These values are what the app currently enforces in code.

| Area | Free | Solo | Plus | Portfolio |
| --- | ---: | ---: | ---: | ---: |
| Properties | 1 | 5 | 10 | 20 |
| Tenants | 3 | 20 | 40 | 80 |
| Documents | 10 | 150 | 400 | 1000 |
| Storage limit | 50 MB | 500 MB | 1.5 GB | 4 GB |
| Max file size | 5 MB | 10 MB | 15 MB | 15 MB |
| Photos per property | 0 | 5 | 10 | 20 |
| Tax exports | Available | Available | Available | Available |

Notes:

- Paid access is currently granted when `workspace_billing.status` is `active` or `trialing`.
- The app stores the selected Stripe plan key in `workspace_billing.plan` as `solo`, `plus`, or `portfolio`.
- Legacy plan value `subscription` is treated as `solo`; legacy `lifetime` is treated as `portfolio`.
- Free plan users keep access to existing data and tax exports.

## Planned tier structure

This table is a draft product plan. Edit this section when deciding the final business model.

| Tier | Intended customer | Price | Properties | Tenants | Documents | Storage limit | Max file size | Photos per property | Notes |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Free | Trial / very small landlord | EUR 0 | 1 | 3 | 10 | 50 MB | 5 MB | 0 | Keep enough value to test the workflow. |
| Solo | Small landlord | EUR 39/year | 5 | 20 | 150 | 500 MB | 10 MB | 5 | This tier mainly removes tenant/document friction and opens photo features; the difference is not only property count. |
| Plus | Growing portfolio | EUR 69/year | 10 | 40 | 400 | 1.5 GB | 15 MB | 10 | For landlords with a growing set of units and more document volume. |
| Portfolio | Larger landlord | EUR 99/year | 20 | 80 | 1000 | 4 GB | 15 MB | 20 | For larger private portfolios that need higher storage and document limits. |
| Custom | 20+ units / special needs | Contact us | Custom | Custom | Custom | Custom | Custom | Custom | Requires manual sales/support flow. |

## Feature Matrix

Use this table to decide which features are included in each tier.

| Feature | Free | Solo | Plus | Portfolio | Custom |
| --- | --- | --- | --- | --- | --- |
| Property management | 1 property | Up to 5 properties | Up to 10 properties | Up to 20 properties | Custom |
| Tenant management | Up to 3 tenants | Up to 20 tenants | Up to 40 tenants | Up to 80 tenants | Custom |
| Lease tracking | Included | Included | Included | Included | Included |
| Rent charge tracking | Included | Included | Included | Included | Included |
| Rent payment status | Included | Included | Included | Included | Included |
| Document upload | 10 docs / 50 MB storage / 5 MB per file | 150 docs / 500 MB storage / 10 MB per file | 400 docs / 1.5 GB storage / 15 MB per file | 1000 docs / 4 GB storage / 15 MB per file | Custom |
| Quittance generation | Not included | Included | Included | Included | Included |
| Tax export package | Not included | Included | Included | Included | Included |
| Property photos | Not included | Included | Included | Included | Included |
| Priority support | No | Included | Included | Included | Included |

## Stripe Mapping

Fill these values when Stripe products and prices are finalized.

| App plan key | Stripe mode | Stripe price env var | Current meaning |
| --- | --- | --- | --- |
| `free` | None | None | Default workspace plan. |
| `solo` | subscription | `NEXT_PUBLIC_STRIPE_PRICE_ID_SOLO` | Solo yearly subscription. |
| `plus` | subscription | `NEXT_PUBLIC_STRIPE_PRICE_ID_PLUS` | Plus yearly subscription. |
| `portfolio` | subscription | `NEXT_PUBLIC_STRIPE_PRICE_ID_PORTFOLIO` | Portfolio yearly subscription. |
| `custom` | Manual | TBD | Planned contact-us tier. |

## Implementation Checklist For Future Changes

When applying edits from this document to the app:

1. Update limits and fallback behavior in `lib/billing/config.ts`.
2. Update resource checks in `lib/billing/limits.ts` if new resources become limited.
3. Update pricing/settings UI copy and visible tier names.
4. Update Stripe checkout plan keys, metadata, and env vars if tier keys change.
5. Add a Supabase migration if the database needs new plan fields.
6. Run `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm smoke:prod`.
