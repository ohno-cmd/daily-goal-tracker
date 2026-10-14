-- 日別目標トラッカー:テーブル、RLS、トリガー(SPEC.md 4章)
-- 保存するのは入力された事実だけ。点数・連続日数などはアプリ側で計算する。

-- 日本時間の「今日」
create or replace function public.tokyo_today() returns date
language sql stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Tokyo')::date $$;

create or replace function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$ begin new.updated_at = now(); return new; end $$;

-- ───────── テーブル ─────────

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null default '',
  final_goal text not null default '',
  mid_goal text not null default '',
  three_month_note text not null default '',
  reward_rate numeric(4,3) not null default 0.8 check (reward_rate > 0 and reward_rate <= 1),
  reward_a_days int not null default 6 check (reward_a_days between 0 and 7),
  started_on date not null default public.tokyo_today(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pillars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  why text not null default '',
  three_month_goal text not null default '',
  metric text not null default '',
  woop_wish text not null default '',
  woop_outcome text not null default '',
  woop_obstacle text not null default '',
  woop_plan text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  time_slot text not null check (time_slot in ('morning', 'daytime', 'night')),
  time_label text not null default '',
  name text not null,
  priority text not null check (priority in ('A', 'B', 'C')),
  pillar_label text not null default '',
  pillar_id uuid,
  if_then text not null default '',
  prep_20sec text not null default '',
  sort_order int not null default 0,
  -- この日から満点に数える(インポートで過去の日を取り込むときに前へずらす)
  active_from date not null default public.tokyo_today(),
  -- アーカイブした日(日本時間)から満点に数えない。それより前の✓と満点は残る
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (pillar_id, user_id) references public.pillars (id, user_id) on delete set null (pillar_id)
);

create table public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  wake_time time,
  declaration text not null default '',
  sleep_time time,
  gratitude text not null default '',
  memo text not null default '',
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create table public.habit_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date date not null,
  habit_id uuid not null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date, habit_id),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);
create index habit_checks_user_date on public.habit_checks (user_id, date);

create table public.habit_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit_id uuid not null,
  priority text not null check (priority in ('A', 'B', 'C')),
  valid_from date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, valid_from),
  foreign key (habit_id, user_id) references public.habits (id, user_id) on delete cascade
);

create table public.benefactors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default '',
  relation text not null default '',
  received text not null default '',
  plan text not null default '',
  progress text not null default '',
  next_action text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.monthly_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  target_yen bigint not null default 3000000,
  actual_yen bigint,
  went_well text not null default '',
  issues text not null default '',
  next_actions text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  worst_habit_id uuid,
  cause text not null default '',
  if_then_fix text not null default '',
  next_big_rock text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start),
  foreign key (worst_habit_id, user_id) references public.habits (id, user_id) on delete set null (worst_habit_id)
);

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  step int not null check (step >= 1),
  text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, step)
);

create table public.mood_boosters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.affirmations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────── RLS:自分の行だけ読み書きできる ─────────

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'pillars', 'habits', 'daily_entries', 'habit_checks', 'habit_versions',
    'benefactors', 'monthly_sales', 'weekly_reviews', 'rewards', 'mood_boosters', 'affirmations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
    execute format('create index %I on public.%I (user_id)', t || '_user_id', t);
  end loop;
end $$;

-- ───────── 優先度の履歴(過去の点数を守る。SPEC 5章) ─────────

create or replace function public.record_habit_version() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.habit_versions (user_id, habit_id, priority, valid_from)
    values (new.user_id, new.id, new.priority, new.active_from);
  elsif new.priority is distinct from old.priority then
    insert into public.habit_versions (user_id, habit_id, priority, valid_from)
    values (new.user_id, new.id, new.priority, greatest(public.tokyo_today(), new.active_from))
    on conflict (habit_id, valid_from) do update set priority = excluded.priority;
  end if;
  return new;
end $$;

create trigger record_habit_version
  after insert or update of priority on public.habits
  for each row execute function public.record_habit_version();

-- ───────── 新しいユーザーにプロフィールを作る ─────────

create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
