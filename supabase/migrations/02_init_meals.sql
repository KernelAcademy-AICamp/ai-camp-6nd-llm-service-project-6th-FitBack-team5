-- meals (식단 기록) + RLS
-- Paste into Supabase SQL Editor and run once. Depends on 01_init_profiles.sql (auth.users).
--
-- 현 UI(diet.tsx)는 끼니별로 칼로리·탄단지를 비정규화로 들고 있어, 이 테이블도
-- UI Meal 타입에 1:1로 매핑되는 단일 테이블로 둔다. foods 카탈로그 정규화는 추후 별도 마이그레이션.

-- ============================================================
-- meals table
-- ============================================================
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null default current_date,
  meal_type text not null check (meal_type in ('아침', '점심', '저녁', '간식')),
  name text not null,
  kcal integer not null default 0 check (kcal >= 0),
  carb integer not null default 0 check (carb >= 0),
  protein integer not null default 0 check (protein >= 0),
  fat integer not null default 0 check (fat >= 0),
  eaten_at timestamptz not null default now(),
  input_method text not null default 'manual' check (input_method in ('image', 'voice', 'manual')),
  created_at timestamptz not null default now()
);

-- 하루치 조회용 인덱스 (user_id + log_date)
create index if not exists meals_user_date_idx
  on public.meals (user_id, log_date);

-- ============================================================
-- RLS — own rows only
-- ============================================================
alter table public.meals enable row level security;

drop policy if exists "meals: read own" on public.meals;
create policy "meals: read own" on public.meals
  for select using (auth.uid() = user_id);

drop policy if exists "meals: insert own" on public.meals;
create policy "meals: insert own" on public.meals
  for insert with check (auth.uid() = user_id);

drop policy if exists "meals: update own" on public.meals;
create policy "meals: update own" on public.meals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "meals: delete own" on public.meals;
create policy "meals: delete own" on public.meals
  for delete using (auth.uid() = user_id);
