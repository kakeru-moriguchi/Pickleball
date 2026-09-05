create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  prefecture text,
  level text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table public.practice_posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.users(id) on delete cascade,
  title text not null, held_on date not null, start_time time not null, end_time time not null,
  venue text not null, prefecture text not null, capacity integer not null check (capacity > 0), fee integer not null default 0 check (fee >= 0),
  level text not null, description text not null, organizer_name text not null,
  status text not null default 'open' check (status in ('open','closed')), created_at timestamptz not null default now()
);
create index idx_practice_date_prefecture on public.practice_posts(held_on,prefecture);
create index idx_practice_author on public.practice_posts(author_id);

create table public.member_posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.users(id) on delete cascade,
  tournament_name text not null, tournament_date date not null, venue text not null, prefecture text not null,
  title text not null, capacity integer not null check (capacity > 0), category text not null, level text not null,
  description text not null, deadline date not null, author_name text not null,
  status text not null default 'open' check (status in ('open','closed')), created_at timestamptz not null default now()
);
create index idx_member_date_category on public.member_posts(tournament_date,category);
create index idx_member_author on public.member_posts(author_id);

create table public.event_posts (
  id uuid primary key default gen_random_uuid(), author_id uuid not null references public.users(id) on delete cascade,
  event_name text not null, event_type text not null, held_on date not null, start_time time not null, end_time time not null,
  venue text not null, prefecture text not null, fee integer not null default 0 check (fee >= 0), capacity integer not null check (capacity > 0),
  description text not null, organizer text not null, application_method text not null,
  status text not null default 'open' check (status in ('open','closed')), created_at timestamptz not null default now()
);
create index idx_event_date_type on public.event_posts(held_on,event_type);
create index idx_event_author on public.event_posts(author_id);

create table public.participations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users(id) on delete cascade,
  post_type text not null check (post_type in ('practice','member','event')), post_id uuid not null,
  status text not null check (status in ('joined','interested')), created_at timestamptz not null default now(),
  unique(user_id,post_type,post_id)
);
create index idx_participations_post on public.participations(post_type,post_id);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.users where id=auth.uid() and role='admin');
$$;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.users(id,email,display_name,role)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',split_part(coalesce(new.email,'member'),'@',1)),case when not exists(select 1 from public.users) then 'admin' else 'user' end);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.cleanup_post_participations() returns trigger language plpgsql security definer set search_path=public as $$
begin delete from public.participations where post_type=TG_ARGV[0] and post_id=old.id; return old; end;
$$;
create trigger cleanup_practice_participations after delete on public.practice_posts for each row execute procedure public.cleanup_post_participations('practice');
create trigger cleanup_member_participations after delete on public.member_posts for each row execute procedure public.cleanup_post_participations('member');
create trigger cleanup_event_participations after delete on public.event_posts for each row execute procedure public.cleanup_post_participations('event');

create or replace function public.get_post_participation_counts()
returns table(post_type text,post_id uuid,participant_count bigint)
language sql stable security definer set search_path=public as $$
  select p.post_type,p.post_id,count(*) from public.participations p group by p.post_type,p.post_id;
$$;
grant execute on function public.get_post_participation_counts() to anon,authenticated;

create or replace function public.join_post(p_type text,p_post_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_capacity integer; v_status text; v_count integer;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if p_type not in ('practice','member','event') then raise exception '対象が正しくありません'; end if;
  perform pg_advisory_xact_lock(hashtext(p_type || p_post_id::text));
  if p_type='practice' then select capacity,status into v_capacity,v_status from public.practice_posts where id=p_post_id;
  elsif p_type='member' then select capacity,status into v_capacity,v_status from public.member_posts where id=p_post_id;
  else select capacity,status into v_capacity,v_status from public.event_posts where id=p_post_id; end if;
  if v_capacity is null or v_status<>'open' then raise exception 'この募集は終了しています'; end if;
  select count(*) into v_count from public.participations where post_type=p_type and post_id=p_post_id;
  if v_count>=v_capacity then raise exception '満員になりました'; end if;
  insert into public.participations(user_id,post_type,post_id,status) values(auth.uid(),p_type,p_post_id,case when p_type='member' then 'interested' else 'joined' end);
exception when unique_violation then raise exception 'すでに参加済みです';
end;
$$;
grant execute on function public.join_post(text,uuid) to authenticated;

alter table public.users enable row level security;
alter table public.practice_posts enable row level security;
alter table public.member_posts enable row level security;
alter table public.event_posts enable row level security;
alter table public.participations enable row level security;

create policy users_read_self_or_admin on public.users for select to authenticated using(id=auth.uid() or public.is_admin());
create policy users_update_self_or_admin on public.users for update to authenticated using(id=auth.uid() or public.is_admin()) with check(id=auth.uid() or public.is_admin());

create policy practice_public_read on public.practice_posts for select to anon,authenticated using(true);
create policy practice_insert_own on public.practice_posts for insert to authenticated with check(author_id=auth.uid());
create policy practice_update_own_or_admin on public.practice_posts for update to authenticated using(author_id=auth.uid() or public.is_admin()) with check(author_id=auth.uid() or public.is_admin());
create policy practice_delete_own_or_admin on public.practice_posts for delete to authenticated using(author_id=auth.uid() or public.is_admin());

create policy member_public_read on public.member_posts for select to anon,authenticated using(true);
create policy member_insert_own on public.member_posts for insert to authenticated with check(author_id=auth.uid());
create policy member_update_own_or_admin on public.member_posts for update to authenticated using(author_id=auth.uid() or public.is_admin()) with check(author_id=auth.uid() or public.is_admin());
create policy member_delete_own_or_admin on public.member_posts for delete to authenticated using(author_id=auth.uid() or public.is_admin());

create policy event_public_read on public.event_posts for select to anon,authenticated using(true);
create policy event_insert_own on public.event_posts for insert to authenticated with check(author_id=auth.uid());
create policy event_update_own_or_admin on public.event_posts for update to authenticated using(author_id=auth.uid() or public.is_admin()) with check(author_id=auth.uid() or public.is_admin());
create policy event_delete_own_or_admin on public.event_posts for delete to authenticated using(author_id=auth.uid() or public.is_admin());

create policy participations_read_own on public.participations for select to authenticated using(user_id=auth.uid());
create policy participations_insert_own on public.participations for insert to authenticated with check(user_id=auth.uid());
create policy participations_delete_own on public.participations for delete to authenticated using(user_id=auth.uid());
