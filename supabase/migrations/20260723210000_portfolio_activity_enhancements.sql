create table if not exists public.collection_saved_views (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  month text not null,
  view text not null,
  created_at timestamptz not null default now(),
  constraint collection_saved_views_month_check check (month ~ '^\d{4}-\d{2}$'),
  constraint collection_saved_views_view_check check (view in ('all', 'open', 'unpaid', 'partial', 'paid')),
  constraint collection_saved_views_unique_name unique (workspace_id, user_id, name)
);

create table if not exists public.task_completion_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_key text not null,
  task_type text not null,
  title text not null,
  meta text,
  completed_at timestamptz not null default now(),
  constraint task_completion_events_unique_task unique (workspace_id, user_id, task_key)
);

create table if not exists public.automation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lease_id uuid references public.leases(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  document_id uuid references public.documents(id) on delete set null,
  automation_type text not null,
  status text not null,
  period_month date,
  message text,
  created_at timestamptz not null default now(),
  constraint automation_events_type_check check (automation_type in ('auto_quittance')),
  constraint automation_events_status_check check (status in ('created', 'skipped', 'failed'))
);

create index if not exists collection_saved_views_workspace_user_idx on public.collection_saved_views(workspace_id, user_id);
create index if not exists task_completion_events_workspace_created_idx on public.task_completion_events(workspace_id, completed_at desc);
create index if not exists automation_events_workspace_created_idx on public.automation_events(workspace_id, created_at desc);

alter table public.collection_saved_views enable row level security;
alter table public.task_completion_events enable row level security;
alter table public.automation_events enable row level security;

create policy "Users manage their collection saved views"
on public.collection_saved_views for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (select 1 from public.workspace_members wm where wm.workspace_id = collection_saved_views.workspace_id and wm.user_id = auth.uid())
);

create policy "Users manage their task completion events"
on public.task_completion_events for all to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (select 1 from public.workspace_members wm where wm.workspace_id = task_completion_events.workspace_id and wm.user_id = auth.uid())
);

create policy "Members read automation events"
on public.automation_events for select to authenticated
using (
  exists (select 1 from public.workspace_members wm where wm.workspace_id = automation_events.workspace_id and wm.user_id = auth.uid())
);

create policy "Members create automation events"
on public.automation_events for insert to authenticated
with check (
  exists (select 1 from public.workspace_members wm where wm.workspace_id = automation_events.workspace_id and wm.user_id = auth.uid())
);
