# Supabase Setup

## 1. Create Project

Create a Supabase project for the app.

Recommended first settings:

- Region: choose the region closest to your first users.
- Database password: store it in a password manager.
- Auth provider: email/password is enough for MVP.

## 2. Environment Variables

Create `.env.local` from `.env.example` and fill:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PRICE_ID_MONTHLY=
NEXT_PUBLIC_STRIPE_PRICE_ID_LIFETIME=
```

Find the keys in Supabase:

- Project Settings -> API -> Project URL
- Project Settings -> API -> anon public key
- Project Settings -> API -> service_role key

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client code.

## 3. Auth URLs

In Supabase, open Authentication -> URL Configuration.

For local development:

```text
Site URL: http://localhost:3000
Redirect URLs:
http://localhost:3000/auth/callback
http://localhost:3000/reset-password
http://localhost:3000/zh/auth/callback
http://localhost:3000/en/auth/callback
```

For production later, add the same paths for your Vercel domain and custom domain.

## 4. Database Migration

Run these SQL files in Supabase SQL Editor, in order:

```text
supabase/migrations/20260707110000_initial_auth_workspace.sql
supabase/migrations/20260707120000_properties_tenants_leases.sql
supabase/migrations/20260707130000_rent_charges_payments.sql
supabase/migrations/20260707140000_documents_expenses.sql
supabase/migrations/20260707150000_tax_exports.sql
supabase/migrations/20260707160000_workspace_billing.sql
supabase/migrations/20260707170000_document_storage_delete_policy.sql
```

The first migration creates:

- `profiles`
- `workspaces`
- `workspace_members`
- RLS policies
- `handle_new_user()` trigger

When a user signs up through Supabase Auth, the trigger automatically creates:

- one profile
- one default workspace
- one owner membership

The second migration creates:

- `properties`
- `units`
- `tenants`
- `leases`
- RLS policies for workspace-scoped property and tenant data

The third migration creates:

- `rent_charges`
- `rent_payments`
- RLS policies for rent records

The fourth migration creates:

- Supabase Storage bucket `documents`
- `documents`
- `expenses`
- `tax_categories`
- RLS policies for document and expense data

The fifth migration creates:

- `tax_exports`
- RLS policies for tax export records

The sixth migration creates:

- `workspace_billing`
- free billing rows for existing workspaces
- read-only RLS access for workspace members

The seventh migration creates:

- Storage delete policy for workspace document files

## 5. Local Test

After `.env.local` is filled and the migration has run:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000/login
```

Create a new account. If email confirmation is enabled, confirm the email first. Then log in and open:

```text
http://localhost:3000/dashboard
```

Expected database result:

- `auth.users`: 1 new user
- `public.profiles`: 1 matching profile
- `public.workspaces`: 1 default workspace
- `public.workspace_members`: 1 owner membership
