create table if not exists public.receipt_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  attempted_by uuid references public.profiles(id) on delete set null,
  email_to text,
  status text not null,
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint receipt_delivery_logs_status_check check (status in ('sent', 'failed', 'missing_email', 'not_found'))
);

create index if not exists receipt_delivery_logs_workspace_created_idx
  on public.receipt_delivery_logs(workspace_id, created_at desc);

create index if not exists receipt_delivery_logs_document_created_idx
  on public.receipt_delivery_logs(document_id, created_at desc);

alter table public.receipt_delivery_logs enable row level security;

drop policy if exists "Members can read receipt delivery logs" on public.receipt_delivery_logs;

create policy "Members can read receipt delivery logs"
on public.receipt_delivery_logs for select
to authenticated
using (
  exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = receipt_delivery_logs.workspace_id
      and wm.user_id = auth.uid()
  )
);

drop policy if exists "Members can create receipt delivery logs" on public.receipt_delivery_logs;

create policy "Members can create receipt delivery logs"
on public.receipt_delivery_logs for insert
to authenticated
with check (
  attempted_by = auth.uid()
  and exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = receipt_delivery_logs.workspace_id
      and wm.user_id = auth.uid()
  )
);
