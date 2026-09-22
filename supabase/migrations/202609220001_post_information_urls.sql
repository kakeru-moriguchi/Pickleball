-- Existing rows and values are preserved. These nullable columns only add an optional link.
alter table public.member_posts
  add column if not exists information_url text;

alter table public.event_posts
  add column if not exists information_url text;

alter table public.member_posts
  add constraint member_posts_information_url_http
    check (information_url is null or information_url ~ '^https?://');

alter table public.event_posts
  add constraint event_posts_information_url_http
    check (information_url is null or information_url ~ '^https?://');
