-- centers table + RLS (owner-only). Run AFTER 03_memberships.sql.
--
-- Doc -> column mapping:
--   센터명   -> name
--   주소     -> address
--   위도     -> latitude   (numeric(10,8), -90~90)
--   경도     -> longitude  (numeric(11,8), -180~180)
-- membership_id links the center to its membership (STEP 3 onboarding).

create table if not exists public.centers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  name text not null,
  address text,
  latitude numeric(10, 8) check (latitude is null or latitude between -90 and 90),
  longitude numeric(11, 8) check (longitude is null or longitude between -180 and 180),
  created_at timestamptz not null default now()
);

create index if not exists centers_user_id_idx on public.centers (user_id);
create index if not exists centers_membership_id_idx on public.centers (membership_id);

alter table public.centers enable row level security;

drop policy if exists "centers: read own" on public.centers;
create policy "centers: read own" on public.centers
  for select using (auth.uid() = user_id);

drop policy if exists "centers: insert own" on public.centers;
create policy "centers: insert own" on public.centers
  for insert with check (auth.uid() = user_id);

drop policy if exists "centers: update own" on public.centers;
create policy "centers: update own" on public.centers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "centers: delete own" on public.centers;
create policy "centers: delete own" on public.centers
  for delete using (auth.uid() = user_id);
