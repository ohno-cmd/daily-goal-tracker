-- 見た目を人ごとに選べる(cute:かわいい / cool:かっこいい)
alter table public.profiles add column theme text not null default 'cute' check (theme in ('cute', 'cool'));
