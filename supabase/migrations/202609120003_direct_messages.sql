begin;

alter table public.participations
  add column chat_blocked_by_applicant boolean not null default false,
  add column chat_blocked_by_organizer boolean not null default false;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  participation_id uuid not null references public.participations(id) on delete cascade,
  sender_user_id uuid references public.users(id) on delete set null,
  sender_guest_id uuid,
  sender_role text not null check (sender_role in ('applicant', 'organizer')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check ((sender_user_id is not null and sender_guest_id is null) or (sender_user_id is null and sender_guest_id is not null))
);
create index messages_participation_created_idx on public.messages(participation_id, created_at);

create table public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_user_id uuid references public.users(id) on delete set null,
  reporter_guest_id uuid,
  reason text not null check (reason in ('迷惑行為・勧誘', '不適切な内容', '個人情報の要求', 'その他')),
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  check (reporter_user_id is not null or reporter_guest_id is not null)
);
create index message_reports_status_created_idx on public.message_reports(status, created_at desc);
create unique index message_reports_user_once_idx on public.message_reports(message_id, reporter_user_id) where reporter_user_id is not null;
create unique index message_reports_guest_once_idx on public.message_reports(message_id, reporter_guest_id) where reporter_guest_id is not null;

alter table public.messages enable row level security;
alter table public.message_reports enable row level security;
revoke all on table public.messages, public.message_reports from anon, authenticated;
grant select on table public.messages to authenticated;
grant select, update on table public.message_reports to authenticated;

create policy messages_participant_read on public.messages for select to authenticated using (
  exists (
    select 1 from public.participations p
    where p.id = messages.participation_id and (
      p.user_id = auth.uid() or
      (p.post_type = 'practice' and exists(select 1 from public.practice_posts x where x.id = p.post_id and x.author_id = auth.uid())) or
      (p.post_type = 'member' and exists(select 1 from public.member_posts x where x.id = p.post_id and x.author_id = auth.uid())) or
      (p.post_type = 'event' and exists(select 1 from public.event_posts x where x.id = p.post_id and x.author_id = auth.uid())) or
      public.is_admin()
    )
  )
);
create policy message_reports_admin_read on public.message_reports for select to authenticated using (public.is_admin());
create policy message_reports_admin_update on public.message_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop function public.get_my_participations(uuid);
create function public.get_my_participations(p_guest_id uuid default null)
returns table(post_type text, post_id uuid, participation_id uuid, participation_status text, unread_count bigint, chat_blocked boolean, blocked_by_me boolean)
language sql stable security definer set search_path = public as $$
  select p.post_type, p.post_id, p.id, p.status,
    (select count(*) from public.messages m where m.participation_id = p.id and m.sender_role = 'organizer' and m.read_at is null)::bigint,
    (p.chat_blocked_by_applicant or p.chat_blocked_by_organizer), p.chat_blocked_by_applicant
  from public.participations p
  where (auth.uid() is not null and p.user_id = auth.uid())
     or (p_guest_id is not null and p.guest_id = p_guest_id);
$$;

drop function public.get_post_applicants(text, uuid);
create function public.get_post_applicants(p_type text, p_post_id uuid)
returns table(
  id uuid, applicant_name text, level text, party_size integer,
  has_paddle boolean, has_net boolean, has_ball boolean,
  contact_method text, contact_value text, application_status text,
  unread_count bigint, chat_blocked boolean, blocked_by_me boolean, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare v_author_id uuid;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if p_type = 'practice' then select author_id into v_author_id from public.practice_posts where practice_posts.id = p_post_id;
  elsif p_type = 'member' then select author_id into v_author_id from public.member_posts where member_posts.id = p_post_id;
  elsif p_type = 'event' then select author_id into v_author_id from public.event_posts where event_posts.id = p_post_id;
  else raise exception '対象が正しくありません'; end if;
  if v_author_id is null then raise exception '募集が見つかりません'; end if;
  if v_author_id <> auth.uid() and not public.is_admin() then raise exception '応募者を確認する権限がありません'; end if;
  return query
    select p.id, p.applicant_name, p.level, p.party_size, p.has_paddle, p.has_net, p.has_ball,
      p.contact_method, p.contact_value, p.status,
      (select count(*) from public.messages m where m.participation_id = p.id and m.sender_role = 'applicant' and m.read_at is null)::bigint,
      (p.chat_blocked_by_applicant or p.chat_blocked_by_organizer), p.chat_blocked_by_organizer, p.created_at
    from public.participations p
    where p.post_type = p_type and p.post_id = p_post_id
    order by case p.status when 'pending' then 0 when 'approved' then 1 else 2 end, p.created_at;
end;
$$;

drop function public.get_pending_application_counts();
create function public.get_pending_application_counts()
returns table(post_type text, post_id uuid, pending_count bigint, unread_count bigint)
language sql stable security definer set search_path = public as $$
  select p.post_type, p.post_id,
    count(*) filter (where p.status = 'pending')::bigint,
    coalesce(sum((
      select count(*) from public.messages m
      where m.participation_id = p.id and m.sender_role = 'applicant' and m.read_at is null
    )), 0)::bigint
  from public.participations p
  where public.is_admin()
     or (p.post_type = 'practice' and exists(select 1 from public.practice_posts x where x.id = p.post_id and x.author_id = auth.uid()))
     or (p.post_type = 'member' and exists(select 1 from public.member_posts x where x.id = p.post_id and x.author_id = auth.uid()))
     or (p.post_type = 'event' and exists(select 1 from public.event_posts x where x.id = p.post_id and x.author_id = auth.uid()))
  group by p.post_type, p.post_id;
$$;

create or replace function public.get_participation_messages(p_participation_id uuid, p_guest_id uuid default null)
returns table(id uuid, body text, sender_role text, is_mine boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_p public.participations%rowtype;
  v_author_id uuid;
  v_role text;
begin
  select * into v_p from public.participations where participations.id = p_participation_id;
  if v_p.id is null then raise exception '応募が見つかりません'; end if;
  if v_p.post_type = 'practice' then select x.author_id into v_author_id from public.practice_posts x where x.id = v_p.post_id;
  elsif v_p.post_type = 'member' then select x.author_id into v_author_id from public.member_posts x where x.id = v_p.post_id;
  else select x.author_id into v_author_id from public.event_posts x where x.id = v_p.post_id; end if;
  if auth.uid() is not null and (auth.uid() = v_author_id or public.is_admin()) then v_role := 'organizer';
  elsif (auth.uid() is not null and auth.uid() = v_p.user_id) or (p_guest_id is not null and p_guest_id = v_p.guest_id) then v_role := 'applicant';
  else raise exception 'メッセージを確認する権限がありません'; end if;

  update public.messages set read_at = now()
  where participation_id = p_participation_id and sender_role <> v_role and read_at is null;
  return query select m.id, m.body, m.sender_role, m.sender_role = v_role, m.created_at
    from public.messages m where m.participation_id = p_participation_id order by m.created_at;
end;
$$;

create or replace function public.send_participation_message(
  p_participation_id uuid, p_body text, p_guest_id uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_p public.participations%rowtype;
  v_author_id uuid;
  v_role text;
  v_recent integer;
begin
  select * into v_p from public.participations where participations.id = p_participation_id;
  if v_p.id is null then raise exception '応募が見つかりません'; end if;
  if v_p.status = 'rejected' then raise exception 'この応募のトークは終了しています'; end if;
  if v_p.post_type = 'practice' then select x.author_id into v_author_id from public.practice_posts x where x.id = v_p.post_id;
  elsif v_p.post_type = 'member' then select x.author_id into v_author_id from public.member_posts x where x.id = v_p.post_id;
  else select x.author_id into v_author_id from public.event_posts x where x.id = v_p.post_id; end if;
  if auth.uid() is not null and auth.uid() = v_author_id then v_role := 'organizer';
  elsif (auth.uid() is not null and auth.uid() = v_p.user_id) or (p_guest_id is not null and p_guest_id = v_p.guest_id) then v_role := 'applicant';
  else raise exception 'メッセージを送る権限がありません'; end if;
  if v_p.chat_blocked_by_applicant or v_p.chat_blocked_by_organizer then raise exception 'このトークは停止されています'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 1000 then raise exception 'メッセージは1000文字以内で入力してください'; end if;
  select count(*) into v_recent from public.messages where created_at > now() - interval '1 hour' and (
    (auth.uid() is not null and sender_user_id = auth.uid()) or (auth.uid() is null and p_guest_id is not null and sender_guest_id = p_guest_id)
  );
  if v_recent >= 60 then raise exception '短時間のメッセージ送信回数が上限に達しました'; end if;
  insert into public.messages(participation_id, sender_user_id, sender_guest_id, sender_role, body)
  values(p_participation_id, auth.uid(), case when auth.uid() is null then p_guest_id else null end, v_role, trim(p_body));
end;
$$;

create or replace function public.set_participation_chat_blocked(
  p_participation_id uuid, p_blocked boolean, p_guest_id uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_p public.participations%rowtype; v_author_id uuid;
begin
  select * into v_p from public.participations where id = p_participation_id;
  if v_p.post_type = 'practice' then select x.author_id into v_author_id from public.practice_posts x where x.id = v_p.post_id;
  elsif v_p.post_type = 'member' then select x.author_id into v_author_id from public.member_posts x where x.id = v_p.post_id;
  else select x.author_id into v_author_id from public.event_posts x where x.id = v_p.post_id; end if;
  if auth.uid() is not null and auth.uid() = v_author_id then
    update public.participations set chat_blocked_by_organizer = p_blocked where id = p_participation_id;
  elsif (auth.uid() is not null and auth.uid() = v_p.user_id) or (p_guest_id is not null and p_guest_id = v_p.guest_id) then
    update public.participations set chat_blocked_by_applicant = p_blocked where id = p_participation_id;
  else raise exception 'トークを管理する権限がありません'; end if;
end;
$$;

create or replace function public.create_message_report(
  p_message_id uuid, p_reason text, p_details text, p_guest_id uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_participation_id uuid; v_p public.participations%rowtype; v_author_id uuid;
begin
  select participation_id into v_participation_id from public.messages where id = p_message_id;
  select * into v_p from public.participations where id = v_participation_id;
  if v_p.post_type = 'practice' then select x.author_id into v_author_id from public.practice_posts x where x.id = v_p.post_id;
  elsif v_p.post_type = 'member' then select x.author_id into v_author_id from public.member_posts x where x.id = v_p.post_id;
  else select x.author_id into v_author_id from public.event_posts x where x.id = v_p.post_id; end if;
  if not ((auth.uid() is not null and (auth.uid() = v_author_id or auth.uid() = v_p.user_id)) or (p_guest_id is not null and p_guest_id = v_p.guest_id)) then
    raise exception '通報する権限がありません';
  end if;
  if p_reason not in ('迷惑行為・勧誘', '不適切な内容', '個人情報の要求', 'その他') then raise exception '通報理由が正しくありません'; end if;
  if char_length(coalesce(p_details, '')) > 1000 then raise exception '詳細は1000文字以内で入力してください'; end if;
  insert into public.message_reports(message_id, reporter_user_id, reporter_guest_id, reason, details)
  values(p_message_id, auth.uid(), case when auth.uid() is null then p_guest_id else null end, p_reason, trim(coalesce(p_details, '')));
end;
$$;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

revoke execute on function public.get_my_participations(uuid) from public;
grant execute on function public.get_my_participations(uuid) to anon, authenticated;
revoke execute on function public.get_post_applicants(text, uuid) from public, anon;
grant execute on function public.get_post_applicants(text, uuid) to authenticated;
revoke execute on function public.get_pending_application_counts() from public, anon;
grant execute on function public.get_pending_application_counts() to authenticated;
revoke execute on function public.get_participation_messages(uuid, uuid) from public;
grant execute on function public.get_participation_messages(uuid, uuid) to anon, authenticated;
revoke execute on function public.send_participation_message(uuid, text, uuid) from public;
grant execute on function public.send_participation_message(uuid, text, uuid) to anon, authenticated;
revoke execute on function public.set_participation_chat_blocked(uuid, boolean, uuid) from public;
grant execute on function public.set_participation_chat_blocked(uuid, boolean, uuid) to anon, authenticated;
revoke execute on function public.create_message_report(uuid, text, text, uuid) from public;
grant execute on function public.create_message_report(uuid, text, text, uuid) to anon, authenticated;

commit;
