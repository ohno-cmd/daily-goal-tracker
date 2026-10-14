-- パートナー:お互いの「今日」(習慣・✓・日次の記録・プロフィール)を見られる。書き込みは自分の分だけ

create table public.partners (
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, partner_id),
  check (user_id <> partner_id)
);

alter table public.partners enable row level security;
create policy "own rows" on public.partners for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.partners from anon;
grant select on public.partners to authenticated;

-- ログイン中の人が owner の記録を見てよいか(パートナーなら true)
create or replace function public.can_view(owner uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.partners where user_id = (select auth.uid()) and partner_id = owner)
$$;

revoke all on function public.can_view(uuid) from public;
grant execute on function public.can_view(uuid) to authenticated;

-- 読むだけ。RLSのポリシーは「または」で効くので、自分の行の読み書きはそのまま
do $$
declare t text;
begin
  foreach t in array array['profiles', 'habits', 'habit_versions', 'habit_checks', 'daily_entries'] loop
    execute format(
      'create policy "partner can read" on public.%I for select to authenticated using (public.can_view(user_id))', t);
  end loop;
end $$;
