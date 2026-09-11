begin;

alter table public.participations alter column user_id drop not null;
alter table public.participations
  add column guest_id uuid,
  add column applicant_name text,
  add column level text,
  add column party_size integer not null default 1 check (party_size between 1 and 50),
  add column has_paddle boolean not null default false,
  add column has_net boolean not null default false,
  add column has_ball boolean not null default false;

update public.participations p
set applicant_name = coalesce(u.display_name, '参加者'),
    level = coalesce(u.level, 'レベル不問')
from public.users u
where p.user_id = u.id;

update public.participations
set applicant_name = coalesce(applicant_name, '参加者'),
    level = coalesce(level, 'レベル不問');

alter table public.participations
  alter column applicant_name set not null,
  alter column level set not null,
  add constraint participations_actor_check
    check ((user_id is not null and guest_id is null) or (user_id is null and guest_id is not null));

alter table public.participations
  drop constraint participations_user_id_post_type_post_id_key;
create unique index participations_user_post_unique
  on public.participations(user_id, post_type, post_id)
  where user_id is not null;
create unique index participations_guest_post_unique
  on public.participations(guest_id, post_type, post_id)
  where guest_id is not null;

drop policy if exists participations_insert_own on public.participations;
drop policy if exists participations_delete_own on public.participations;
revoke insert, update, delete on table public.participations from anon, authenticated;

create or replace function public.get_post_participation_counts()
returns table(post_type text, post_id uuid, participant_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.post_type, p.post_id, coalesce(sum(p.party_size), 0)::bigint
  from public.participations p
  group by p.post_type, p.post_id;
$$;

drop function if exists public.join_post(text, uuid);
create function public.join_post(
  p_type text,
  p_post_id uuid,
  p_applicant_name text,
  p_level text,
  p_party_size integer,
  p_has_paddle boolean,
  p_has_net boolean,
  p_has_ball boolean,
  p_guest_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity integer;
  v_status text;
  v_count integer;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null and p_guest_id is null then
    raise exception '応募情報を確認できません';
  end if;
  if p_type not in ('practice', 'member', 'event') then
    raise exception '対象が正しくありません';
  end if;
  if char_length(trim(coalesce(p_applicant_name, ''))) not between 1 and 80 then
    raise exception '名前を80文字以内で入力してください';
  end if;
  if p_level not in ('初心者歓迎', '初級', '中級', '上級', 'レベル不問') then
    raise exception 'レベルが正しくありません';
  end if;
  if p_party_size is null or p_party_size not between 1 and 50 then
    raise exception '参加人数が正しくありません';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_type || p_post_id::text));
  if p_type = 'practice' then
    select capacity, status into v_capacity, v_status from public.practice_posts where id = p_post_id;
  elsif p_type = 'member' then
    select capacity, status into v_capacity, v_status from public.member_posts where id = p_post_id;
  else
    select capacity, status into v_capacity, v_status from public.event_posts where id = p_post_id;
  end if;
  if v_capacity is null or v_status <> 'open' then
    raise exception 'この募集は終了しています';
  end if;
  if exists (
    select 1 from public.participations
    where post_type = p_type and post_id = p_post_id
      and ((v_user_id is not null and user_id = v_user_id) or (p_guest_id is not null and guest_id = p_guest_id))
  ) then
    raise exception 'すでに応募済みです';
  end if;
  select coalesce(sum(party_size), 0) into v_count
  from public.participations where post_type = p_type and post_id = p_post_id;
  if v_count + p_party_size > v_capacity then
    raise exception '残り募集人数を超えています';
  end if;

  insert into public.participations(
    user_id, guest_id, post_type, post_id, status, applicant_name, level,
    party_size, has_paddle, has_net, has_ball
  ) values (
    v_user_id,
    case when v_user_id is null then p_guest_id else null end,
    p_type,
    p_post_id,
    case when p_type = 'member' then 'interested' else 'joined' end,
    trim(p_applicant_name),
    p_level,
    p_party_size,
    coalesce(p_has_paddle, false),
    coalesce(p_has_net, false),
    coalesce(p_has_ball, false)
  );
end;
$$;

create or replace function public.cancel_post_participation(
  p_type text,
  p_post_id uuid,
  p_guest_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null and p_guest_id is null then
    raise exception 'この端末の応募情報が見つかりません';
  end if;
  delete from public.participations
  where post_type = p_type and post_id = p_post_id
    and ((auth.uid() is not null and user_id = auth.uid()) or (p_guest_id is not null and guest_id = p_guest_id));
end;
$$;

create or replace function public.get_my_participations(p_guest_id uuid default null)
returns table(post_type text, post_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.post_type, p.post_id
  from public.participations p
  where (auth.uid() is not null and p.user_id = auth.uid())
     or (p_guest_id is not null and p.guest_id = p_guest_id);
$$;

create or replace function public.get_post_applicants(p_type text, p_post_id uuid)
returns table(
  id uuid,
  applicant_name text,
  level text,
  party_size integer,
  has_paddle boolean,
  has_net boolean,
  has_ball boolean,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_author_id uuid;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if p_type = 'practice' then select author_id into v_author_id from public.practice_posts where practice_posts.id = p_post_id;
  elsif p_type = 'member' then select author_id into v_author_id from public.member_posts where member_posts.id = p_post_id;
  elsif p_type = 'event' then select author_id into v_author_id from public.event_posts where event_posts.id = p_post_id;
  else raise exception '対象が正しくありません';
  end if;
  if v_author_id is null then raise exception '募集が見つかりません'; end if;
  if v_author_id <> auth.uid() and not public.is_admin() then raise exception '応募者を確認する権限がありません'; end if;

  return query
  select p.id, p.applicant_name, p.level, p.party_size,
         p.has_paddle, p.has_net, p.has_ball, p.created_at
  from public.participations p
  where p.post_type = p_type and p.post_id = p_post_id
  order by p.created_at;
end;
$$;

revoke execute on function public.join_post(text, uuid, text, text, integer, boolean, boolean, boolean, uuid) from public;
grant execute on function public.join_post(text, uuid, text, text, integer, boolean, boolean, boolean, uuid) to anon, authenticated;
revoke execute on function public.cancel_post_participation(text, uuid, uuid) from public;
grant execute on function public.cancel_post_participation(text, uuid, uuid) to anon, authenticated;
revoke execute on function public.get_my_participations(uuid) from public;
grant execute on function public.get_my_participations(uuid) to anon, authenticated;
revoke execute on function public.get_post_applicants(text, uuid) from public, anon;
grant execute on function public.get_post_applicants(text, uuid) to authenticated;

commit;
