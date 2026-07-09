# HabitatLog Billing Plans

This document is the product source of truth for membership tiers and feature limits.

When this file changes, update the app code to match it, especially:

- `lib/billing/config.ts`
- `lib/billing/limits.ts`
- settings and pricing UI copy
- Stripe price ids and checkout metadata
- Supabase migrations if a new stored field is needed

## Current implementation snapshot

These values are what the app currently enforces in code.

| Area | Free | Paid subscription | Lifetime |
| --- | ---: | ---: | ---: |
| Properties | 1 | Unlimited by current code | Unlimited by current code |
| Tenants | 3 | Unlimited by current code | Unlimited by current code |
| Documents | 10 | Unlimited by current code | Unlimited by current code |
| Photos per property | 0 | 5 | 20 |
| Tax exports | Available | Available | Available |

Notes:

- Paid access is currently granted when `workspace_billing.status` is `active` or `trialing`.
- Lifetime access is currently granted when `workspace_billing.lifetime_access` is true.
- The current app treats Stripe plan value `subscription` like `solo` for photo limits.
- The current app treats Stripe plan value `lifetime` like `portfolio` for photo limits.
- Free plan users keep access to existing data and tax exports.

## Planned tier structure

This table is a draft product plan. Edit this section when deciding the final business model.

| Tier | Intended customer | Price | Properties | Tenants | Documents | Photos per property | Notes |
| --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| Free | Trial / very small landlord | EUR 0 | 1 | 3 | 10 | 0 | Keep enough value to test the workflow. |
| Solo | Small landlord | EUR 49/year | 1-5 | TBD | TBD | 5 | Current `subscription` fallback behaves closest to this tier. |
| Plus | Growing portfolio | EUR 89/year | 6-10 | TBD | TBD | 10 | Planned tier; not fully enforced in code yet. |
| Portfolio | Larger landlord | EUR 149/year | 11-20 | TBD | TBD | 20 | Current `lifetime` fallback behaves closest to this tier for photos. |
| Custom | 20+ units / special needs | Contact us | Custom | Custom | Custom | Custom | Requires manual sales/support flow. |

## Feature Matrix

Use this table to decide which features are included in each tier.

| Feature | Free | Solo | Plus | Portfolio | Custom |
| --- | --- | --- | --- | --- | --- |
| Property management | Limited | Included | Included | Included | Included |
| Tenant management | Limited | Included | Included | Included | Included |
| Lease tracking | Included | Included | Included | Included | Included |
| Rent charge tracking | Included | Included | Included | Included | Included |
| Rent payment status | Included | Included | Included | Included | Included |
| Document upload | Limited | Included | Included | Included | Included |
| Quittance generation | TBD | TBD | TBD | TBD | TBD |
| Tax export package | Included | Included | Included | Included | Included |
| Property photos | Not included | Included | Included | Included | Included |
| Priority support | No | TBD | TBD | TBD | TBD |

## Stripe Mapping

Fill these values when Stripe products and prices are finalized.

| App plan key | Stripe mode | Stripe price env var | Current meaning |
| --- | --- | --- | --- |
| `free` | None | None | Default workspace plan. |
| `subscription` | subscription | `STRIPE_SUBSCRIPTION_PRICE_ID` | Current paid yearly/monthly subscription entry. |
| `lifetime` | payment | `STRIPE_LIFETIME_PRICE_ID` | Current one-time payment entry. |
| `solo` | TBD | TBD | Planned explicit tier. |
| `plus` | TBD | TBD | Planned explicit tier. |
| `portfolio` | TBD | TBD | Planned explicit tier. |
| `custom` | Manual | TBD | Planned contact-us tier. |

## Implementation Checklist For Future Changes

When applying edits from this document to the app:

1. Update limits and fallback behavior in `lib/billing/config.ts`.
2. Update resource checks in `lib/billing/limits.ts` if new resources become limited.
3. Update pricing/settings UI copy and visible tier names.
4. Update Stripe checkout plan keys, metadata, and env vars if tier keys change.
5. Add a Supabase migration if the database needs new plan fields.
6. Run `pnpm typecheck`, `pnpm lint`, `pnpm build`, and `pnpm smoke:prod`.

