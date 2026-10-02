alter table public.event_posts
  add column if not exists level text not null default 'レベル不問';

comment on column public.event_posts.level is
  '対象レベル。複数の場合はカンマ区切りで保存する。';
