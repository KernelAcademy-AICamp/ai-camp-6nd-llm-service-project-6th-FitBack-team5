-- food_favorites: 음식 즐겨찾기 (user_id + name 쌍으로 중복 방지)
create table if not exists public.food_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kcal integer not null default 0 check (kcal >= 0),
  carb integer not null default 0 check (carb >= 0),
  protein integer not null default 0 check (protein >= 0),
  fat integer not null default 0 check (fat >= 0),
  serving_size text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists food_favorites_user_idx
  on public.food_favorites (user_id);

alter table public.food_favorites enable row level security;

drop policy if exists "food_favorites: read own" on public.food_favorites;
create policy "food_favorites: read own" on public.food_favorites
  for select using (auth.uid() = user_id);

drop policy if exists "food_favorites: insert own" on public.food_favorites;
create policy "food_favorites: insert own" on public.food_favorites
  for insert with check (auth.uid() = user_id);

drop policy if exists "food_favorites: delete own" on public.food_favorites;
create policy "food_favorites: delete own" on public.food_favorites
  for delete using (auth.uid() = user_id);
