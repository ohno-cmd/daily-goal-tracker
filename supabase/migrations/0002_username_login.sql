-- 名前とパスワードでログインする。Supabase Auth はメールで本人を区別するので、名前 → メールを引けるようにする

alter table public.profiles add column username text;
create unique index profiles_username_key on public.profiles (lower(username));
alter table public.profiles add constraint profiles_username_format check (username is null or username ~ '^[^\s@]{2,30}$');

-- ログイン前(未ログイン)でも呼べる。名前が無ければ null を返す
create or replace function public.email_for_login(p_username text) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where lower(p.username) = lower(trim(p_username))
  limit 1
$$;

revoke all on function public.email_for_login(text) from public;
grant execute on function public.email_for_login(text) to anon, authenticated;
