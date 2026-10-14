-- 「柱」の呼び方を人ごとに変えられる(例:大切な軸)
alter table public.profiles add column pillar_term text not null default '柱' check (char_length(pillar_term) between 1 and 10);
