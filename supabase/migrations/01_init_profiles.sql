-- profiles + RLS + triggers + is_admin helper
-- Paste into Supabase SQL Editor and run once.

-- ============================================================
-- profiles table
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- updated_at maintenance
-- ============================================================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- Auto-create a profile row when a new auth user is inserted
-- ============================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any users that already exist (e.g. dev test account created in dashboard)
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- ============================================================
-- is_admin() helper — defined now but not yet referenced anywhere.
-- Future policies: `using (is_admin() or user_id = auth.uid())`.
-- ============================================================
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- ============================================================
-- Prevent self-elevation: silently ignore role changes from non-admins.
-- Without this, the "update own row" policy would let a user set role='admin'.
-- ============================================================
create or replace function public.prevent_role_self_elevation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.role is distinct from new.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_elevation on public.profiles;
create trigger profiles_prevent_role_elevation
  before update on public.profiles
  for each row execute function public.prevent_role_self_elevation();

-- ============================================================
-- RLS — own row only
-- ============================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- No INSERT policy: profiles are inserted only via the SECURITY DEFINER trigger.
-- No DELETE policy: profile rows are removed via auth.users ON DELETE CASCADE.
