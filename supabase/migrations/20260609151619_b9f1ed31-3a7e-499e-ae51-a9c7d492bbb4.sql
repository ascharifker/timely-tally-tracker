-- Vacation delegation: temporarily grant a reviewer's track-edit rights to another user.
create table public.review_delegations (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  track public.review_track not null,
  start_date date not null,
  end_date date not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (from_user_id <> to_user_id)
);

grant select, insert, update, delete on public.review_delegations to authenticated;
grant all on public.review_delegations to service_role;

alter table public.review_delegations enable row level security;

-- Anyone authenticated can read delegations (so reviewers see who's covering them).
create policy "Authenticated can read delegations"
  on public.review_delegations for select
  to authenticated
  using (true);

-- Only admins can create / modify / delete delegations.
create policy "Admins manage delegations insert"
  on public.review_delegations for insert
  to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage delegations update"
  on public.review_delegations for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "Admins manage delegations delete"
  on public.review_delegations for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create trigger trg_review_delegations_updated_at
  before update on public.review_delegations
  for each row execute function public.touch_updated_at();

create index review_delegations_active_idx
  on public.review_delegations (to_user_id, track, start_date, end_date);

-- Has the caller been delegated edit rights on a given track right now?
create or replace function public.has_active_delegation(_user_id uuid, _track public.review_track)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.review_delegations
    where to_user_id = _user_id
      and track = _track
      and current_date between start_date and end_date
  )
$$;

-- Extend the existing PO edit check to honor active delegations.
create or replace function public.current_user_can_edit_po(_po_id uuid)
returns boolean
language plpgsql
stable security definer
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
  if public.has_active_delegation(_uid, _track) then
    return true;
  end if;
  return false;
end;
$$;