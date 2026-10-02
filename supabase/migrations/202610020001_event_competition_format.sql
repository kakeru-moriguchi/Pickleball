alter table public.event_posts
  add column if not exists competition_format text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'event_posts_competition_format_check'
      and conrelid = 'public.event_posts'::regclass
  ) then
    alter table public.event_posts
      add constraint event_posts_competition_format_check
      check (competition_format is null or competition_format in ('団体戦', '個人戦'));
  end if;
end
$$;

comment on column public.event_posts.competition_format is
  '大会投稿の形式。団体戦または個人戦。大会以外はnull。';
