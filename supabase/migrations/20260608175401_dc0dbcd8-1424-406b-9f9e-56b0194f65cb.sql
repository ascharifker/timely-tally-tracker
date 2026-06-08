
-- 1. Enums
create type public.app_role as enum (
  'admin','manager','po_editor','coe_reviewer','third_party_reviewer','production_editor','viewer'
);
create type public.review_track as enum ('coe','third_party','internal');

-- 2. user_roles table
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

-- 3. review_track on purchase_orders
alter table public.purchase_orders
  add column review_track public.review_track not null default 'coe';

-- 4. Security-definer helpers
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.current_user_can_edit_po(_po_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _track public.review_track;
  _uid uuid := auth.uid();
begin
  if _uid is null then
    return false;
  end if;
  if public.has_role(_uid, 'admin') or public.has_role(_uid, 'po_editor') then
    return true;
  end if;
  select review_track into _track from public.purchase_orders where id = _po_id;
  if _track is null then
    return false;
  end if;
  if _track = 'coe' and public.has_role(_uid, 'coe_reviewer') then
    return true;
  end if;
  if _track = 'third_party' and public.has_role(_uid, 'third_party_reviewer') then
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.current_user_can_edit_production()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'manager')
    or public.has_role(auth.uid(), 'production_editor')
  )
$$;

-- 5. user_roles policies
create policy "user_roles read own"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "user_roles admin manage"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- 6. Replace policies on PO + production tables
-- purchase_orders
drop policy if exists "purchase_orders read" on public.purchase_orders;
drop policy if exists "purchase_orders insert" on public.purchase_orders;
drop policy if exists "purchase_orders update" on public.purchase_orders;
drop policy if exists "purchase_orders delete" on public.purchase_orders;
drop policy if exists "purchase_orders all" on public.purchase_orders;
drop policy if exists "Allow all" on public.purchase_orders;
drop policy if exists "Enable all access for all users" on public.purchase_orders;

create policy "po read authenticated" on public.purchase_orders
  for select to authenticated using (true);
create policy "po insert by editors" on public.purchase_orders
  for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'po_editor')
    or (review_track = 'coe' and public.has_role(auth.uid(), 'coe_reviewer'))
    or (review_track = 'third_party' and public.has_role(auth.uid(), 'third_party_reviewer'))
  );
create policy "po update by editors" on public.purchase_orders
  for update to authenticated
  using (public.current_user_can_edit_po(id))
  with check (public.current_user_can_edit_po(id));
create policy "po delete by editors" on public.purchase_orders
  for delete to authenticated
  using (public.current_user_can_edit_po(id));

-- po_line_items
drop policy if exists "po_line_items read" on public.po_line_items;
drop policy if exists "po_line_items insert" on public.po_line_items;
drop policy if exists "po_line_items update" on public.po_line_items;
drop policy if exists "po_line_items delete" on public.po_line_items;
drop policy if exists "po_line_items all" on public.po_line_items;
drop policy if exists "Allow all" on public.po_line_items;
drop policy if exists "Enable all access for all users" on public.po_line_items;

create policy "po_lines read authenticated" on public.po_line_items
  for select to authenticated using (true);
create policy "po_lines insert by editors" on public.po_line_items
  for insert to authenticated
  with check (public.current_user_can_edit_po(purchase_order_id));
create policy "po_lines update by editors" on public.po_line_items
  for update to authenticated
  using (public.current_user_can_edit_po(purchase_order_id))
  with check (public.current_user_can_edit_po(purchase_order_id));
create policy "po_lines delete by editors" on public.po_line_items
  for delete to authenticated
  using (public.current_user_can_edit_po(purchase_order_id));

-- jobs
drop policy if exists "jobs read" on public.jobs;
drop policy if exists "jobs insert" on public.jobs;
drop policy if exists "jobs update" on public.jobs;
drop policy if exists "jobs delete" on public.jobs;
drop policy if exists "jobs all" on public.jobs;
drop policy if exists "Allow all" on public.jobs;
drop policy if exists "Enable all access for all users" on public.jobs;

create policy "jobs read authenticated" on public.jobs
  for select to authenticated using (true);
create policy "jobs write by production" on public.jobs
  for all to authenticated
  using (public.current_user_can_edit_production())
  with check (public.current_user_can_edit_production());

-- job_steps
drop policy if exists "job_steps read" on public.job_steps;
drop policy if exists "job_steps insert" on public.job_steps;
drop policy if exists "job_steps update" on public.job_steps;
drop policy if exists "job_steps delete" on public.job_steps;
drop policy if exists "job_steps all" on public.job_steps;
drop policy if exists "Allow all" on public.job_steps;
drop policy if exists "Enable all access for all users" on public.job_steps;

create policy "job_steps read authenticated" on public.job_steps
  for select to authenticated using (true);
create policy "job_steps write by production" on public.job_steps
  for all to authenticated
  using (public.current_user_can_edit_production())
  with check (public.current_user_can_edit_production());

-- machine_runs
drop policy if exists "machine_runs read" on public.machine_runs;
drop policy if exists "machine_runs insert" on public.machine_runs;
drop policy if exists "machine_runs update" on public.machine_runs;
drop policy if exists "machine_runs delete" on public.machine_runs;
drop policy if exists "machine_runs all" on public.machine_runs;
drop policy if exists "Allow all" on public.machine_runs;
drop policy if exists "Enable all access for all users" on public.machine_runs;

create policy "machine_runs read authenticated" on public.machine_runs
  for select to authenticated using (true);
create policy "machine_runs write by production" on public.machine_runs
  for all to authenticated
  using (public.current_user_can_edit_production())
  with check (public.current_user_can_edit_production());
