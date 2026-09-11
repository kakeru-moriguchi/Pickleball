begin;

alter table public.participations
  drop constraint participations_status_check,
  add column contact_method text,
  add column contact_value text,
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.users(id) on delete set null;

update public.participations set status = 'approved';
alter table public.participations
  add constraint participations_status_check check (status in ('pending', 'approved', 'rejected'));

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.users(id) on delete set null,
  reporter_guest_id uuid,
  post_type text not null check (post_type in ('practice', 'member', 'event')),
  post_id uuid not null,
  reason text not null check (reason in ('不適切な内容', '迷惑行為・勧誘', '虚偽・誤解を招く内容', 'その他')),
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  check (reporter_user_id is not null or reporter_guest_id is not null)
);
create index reports_status_created_idx on public.reports(status, created_at desc);

create table public.inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  guest_id uuid,
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  check (user_id is not null or guest_id is not null)
);
create index inquiries_status_created_idx on public.inquiries(status, created_at desc);

alter table public.reports enable row level security;
alter table public.inquiries enable row level security;
revoke all on table public.reports, public.inquiries from anon, authenticated;
grant select, update on table public.reports, public.inquiries to authenticated;
create policy reports_admin_read on public.reports for select to authenticated using (public.is_admin());
create policy reports_admin_update on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy inquiries_admin_read on public.inquiries for select to authenticated using (public.is_admin());
create policy inquiries_admin_update on public.inquiries for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.get_post_participation_counts()
returns table(post_type text, post_id uuid, participant_count bigint)
language sql stable security definer set search_path = public as $$
  select p.post_type, p.post_id, coalesce(sum(p.party_size), 0)::bigint
  from public.participations p
  where p.status = 'approved'
  group by p.post_type, p.post_id;
$$;

drop function public.get_my_participations(uuid);
create function public.get_my_participations(p_guest_id uuid default null)
returns table(post_type text, post_id uuid, participation_status text)
language sql stable security definer set search_path = public as $$
  select p.post_type, p.post_id, p.status
  from public.participations p
  where (auth.uid() is not null and p.user_id = auth.uid())
     or (p_guest_id is not null and p.guest_id = p_guest_id);
$$;

drop function public.get_post_applicants(text, uuid);
create function public.get_post_applicants(p_type text, p_post_id uuid)
returns table(
  id uuid, applicant_name text, level text, party_size integer,
  has_paddle boolean, has_net boolean, has_ball boolean,
  contact_method text, contact_value text, application_status text, created_at timestamptz
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
           p.contact_method, p.contact_value, p.status, p.created_at
    from public.participations p
    where p.post_type = p_type and p.post_id = p_post_id
    order by case p.status when 'pending' then 0 when 'approved' then 1 else 2 end, p.created_at;
end;
$$;

create or replace function public.get_pending_application_counts()
returns table(post_type text, post_id uuid, pending_count bigint)
language sql stable security definer set search_path = public as $$
  select p.post_type, p.post_id, count(*)::bigint
  from public.participations p
  where p.status = 'pending' and (
    (p.post_type = 'practice' and exists(select 1 from public.practice_posts x where x.id = p.post_id and x.author_id = auth.uid())) or
    (p.post_type = 'member' and exists(select 1 from public.member_posts x where x.id = p.post_id and x.author_id = auth.uid())) or
    (p.post_type = 'event' and exists(select 1 from public.event_posts x where x.id = p.post_id and x.author_id = auth.uid())) or
    public.is_admin()
  )
  group by p.post_type, p.post_id;
$$;

drop function public.join_post(text, uuid, text, text, integer, boolean, boolean, boolean, uuid);
create function public.join_post(
  p_type text, p_post_id uuid, p_applicant_name text, p_level text, p_party_size integer,
  p_has_paddle boolean, p_has_net boolean, p_has_ball boolean,
  p_contact_method text, p_contact_value text, p_guest_id uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_status text;
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_recent_count integer;
begin
  if v_user_id is null and p_guest_id is null then raise exception '応募情報を確認できません'; end if;
  if p_type not in ('practice', 'member', 'event') then raise exception '対象が正しくありません'; end if;
  if char_length(trim(coalesce(p_applicant_name, ''))) not between 1 and 80 then raise exception '名前を80文字以内で入力してください'; end if;
  if p_level not in ('初心者歓迎', '初級', '中級', '上級', 'レベル不問') then raise exception 'レベルが正しくありません'; end if;
  if p_party_size is null or p_party_size not between 1 and 50 then raise exception '参加人数が正しくありません'; end if;
  if p_contact_method not in ('メール', 'LINE', 'Instagram', '電話', 'その他') then raise exception '連絡方法が正しくありません'; end if;
  if char_length(trim(coalesce(p_contact_value, ''))) not between 1 and 200 then raise exception '連絡先を200文字以内で入力してください'; end if;

  if p_type = 'practice' then select status into v_status from public.practice_posts where id = p_post_id;
  elsif p_type = 'member' then select status into v_status from public.member_posts where id = p_post_id;
  else select status into v_status from public.event_posts where id = p_post_id; end if;
  if v_status is null or v_status <> 'open' then raise exception 'この募集は終了しています'; end if;

  select count(*) into v_recent_count from public.participations
  where created_at > now() - interval '1 hour'
    and ((v_user_id is not null and user_id = v_user_id) or (p_guest_id is not null and guest_id = p_guest_id));
  if v_recent_count >= 10 then raise exception '短時間の応募回数が上限に達しました'; end if;

  select id into v_existing_id from public.participations
  where post_type = p_type and post_id = p_post_id
    and ((v_user_id is not null and user_id = v_user_id) or (p_guest_id is not null and guest_id = p_guest_id));
  if v_existing_id is not null then
    if exists(select 1 from public.participations where id = v_existing_id and status <> 'rejected') then
      raise exception 'すでに応募済みです';
    end if;
    update public.participations set
      status = 'pending', applicant_name = trim(p_applicant_name), level = p_level, party_size = p_party_size,
      has_paddle = coalesce(p_has_paddle, false), has_net = coalesce(p_has_net, false), has_ball = coalesce(p_has_ball, false),
      contact_method = p_contact_method, contact_value = trim(p_contact_value), created_at = now(), reviewed_at = null, reviewed_by = null
    where id = v_existing_id;
    return;
  end if;

  insert into public.participations(
    user_id, guest_id, post_type, post_id, status, applicant_name, level, party_size,
    has_paddle, has_net, has_ball, contact_method, contact_value
  ) values (
    v_user_id, case when v_user_id is null then p_guest_id else null end,
    p_type, p_post_id, 'pending', trim(p_applicant_name), p_level, p_party_size,
    coalesce(p_has_paddle, false), coalesce(p_has_net, false), coalesce(p_has_ball, false),
    p_contact_method, trim(p_contact_value)
  );
end;
$$;

create or replace function public.review_participation(p_participation_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_post_type text; v_post_id uuid; v_party_size integer; v_author_id uuid;
  v_capacity integer; v_post_status text; v_approved integer;
begin
  if auth.uid() is null then raise exception 'ログインが必要です'; end if;
  if p_status not in ('approved', 'rejected') then raise exception '承認状態が正しくありません'; end if;
  select post_type, post_id, party_size into v_post_type, v_post_id, v_party_size
  from public.participations where id = p_participation_id;
  if v_post_type = 'practice' then select author_id, capacity, status into v_author_id, v_capacity, v_post_status from public.practice_posts where id = v_post_id;
  elsif v_post_type = 'member' then select author_id, capacity, status into v_author_id, v_capacity, v_post_status from public.member_posts where id = v_post_id;
  elsif v_post_type = 'event' then select author_id, capacity, status into v_author_id, v_capacity, v_post_status from public.event_posts where id = v_post_id;
  end if;
  if v_author_id is null then raise exception '募集が見つかりません'; end if;
  if v_author_id <> auth.uid() and not public.is_admin() then raise exception '応募を管理する権限がありません'; end if;
  if p_status = 'approved' then
    if v_post_status <> 'open' then raise exception 'この募集は終了しています'; end if;
    perform pg_advisory_xact_lock(hashtext(v_post_type || v_post_id::text));
    select coalesce(sum(party_size), 0) into v_approved from public.participations
    where post_type = v_post_type and post_id = v_post_id and status = 'approved' and id <> p_participation_id;
    if v_approved + v_party_size > v_capacity then raise exception '定員を超えるため承認できません'; end if;
  end if;
  update public.participations set status = p_status, reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_participation_id;
end;
$$;

create or replace function public.create_report(
  p_type text, p_post_id uuid, p_reason text, p_details text, p_guest_id uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_exists boolean; v_recent integer;
begin
  if auth.uid() is null and p_guest_id is null then raise exception '通報情報を確認できません'; end if;
  if p_type not in ('practice', 'member', 'event') then raise exception '対象が正しくありません'; end if;
  if p_reason not in ('不適切な内容', '迷惑行為・勧誘', '虚偽・誤解を招く内容', 'その他') then raise exception '通報理由が正しくありません'; end if;
  if char_length(coalesce(p_details, '')) > 1000 then raise exception '詳細は1000文字以内で入力してください'; end if;
  select case p_type
    when 'practice' then exists(select 1 from public.practice_posts where id = p_post_id)
    when 'member' then exists(select 1 from public.member_posts where id = p_post_id)
    else exists(select 1 from public.event_posts where id = p_post_id) end into v_exists;
  if not v_exists then raise exception '募集が見つかりません'; end if;
  select count(*) into v_recent from public.reports where created_at > now() - interval '1 day'
    and ((auth.uid() is not null and reporter_user_id = auth.uid()) or (p_guest_id is not null and reporter_guest_id = p_guest_id));
  if v_recent >= 5 then raise exception '本日の通報回数が上限に達しました'; end if;
  insert into public.reports(reporter_user_id, reporter_guest_id, post_type, post_id, reason, details)
  values(auth.uid(), case when auth.uid() is null then p_guest_id else null end, p_type, p_post_id, p_reason, trim(coalesce(p_details, '')));
end;
$$;

create or replace function public.create_inquiry(
  p_name text, p_email text, p_message text, p_guest_id uuid default null
)
returns void
language plpgsql security definer set search_path = public as $$
declare v_recent integer;
begin
  if auth.uid() is null and p_guest_id is null then raise exception '送信情報を確認できません'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 80 then raise exception '名前を80文字以内で入力してください'; end if;
  if char_length(trim(coalesce(p_email, ''))) not between 3 and 200 or position('@' in p_email) = 0 then raise exception 'メールアドレスが正しくありません'; end if;
  if char_length(trim(coalesce(p_message, ''))) not between 1 and 2000 then raise exception 'お問い合わせ内容を2000文字以内で入力してください'; end if;
  select count(*) into v_recent from public.inquiries where created_at > now() - interval '1 day'
    and ((auth.uid() is not null and user_id = auth.uid()) or (p_guest_id is not null and guest_id = p_guest_id));
  if v_recent >= 3 then raise exception '本日のお問い合わせ回数が上限に達しました'; end if;
  insert into public.inquiries(user_id, guest_id, name, email, message)
  values(auth.uid(), case when auth.uid() is null then p_guest_id else null end, trim(p_name), lower(trim(p_email)), trim(p_message));
end;
$$;

create or replace function public.enforce_post_rate_limit()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_recent integer;
begin
  select count(*) into v_recent from (
    select created_at from public.practice_posts where author_id = new.author_id and created_at > now() - interval '1 hour'
    union all select created_at from public.member_posts where author_id = new.author_id and created_at > now() - interval '1 hour'
    union all select created_at from public.event_posts where author_id = new.author_id and created_at > now() - interval '1 hour'
  ) recent;
  if v_recent >= 10 then raise exception '短時間の投稿回数が上限に達しました'; end if;
  return new;
end;
$$;
create trigger practice_post_rate_limit before insert on public.practice_posts for each row execute function public.enforce_post_rate_limit();
create trigger member_post_rate_limit before insert on public.member_posts for each row execute function public.enforce_post_rate_limit();
create trigger event_post_rate_limit before insert on public.event_posts for each row execute function public.enforce_post_rate_limit();

revoke execute on function public.get_my_participations(uuid) from public;
grant execute on function public.get_my_participations(uuid) to anon, authenticated;
revoke execute on function public.get_post_applicants(text, uuid) from public, anon;
grant execute on function public.get_post_applicants(text, uuid) to authenticated;
revoke execute on function public.get_pending_application_counts() from public, anon;
grant execute on function public.get_pending_application_counts() to authenticated;
revoke execute on function public.join_post(text, uuid, text, text, integer, boolean, boolean, boolean, text, text, uuid) from public;
grant execute on function public.join_post(text, uuid, text, text, integer, boolean, boolean, boolean, text, text, uuid) to anon, authenticated;
revoke execute on function public.review_participation(uuid, text) from public, anon;
grant execute on function public.review_participation(uuid, text) to authenticated;
revoke execute on function public.create_report(text, uuid, text, text, uuid) from public;
grant execute on function public.create_report(text, uuid, text, text, uuid) to anon, authenticated;
revoke execute on function public.create_inquiry(text, text, text, uuid) from public;
grant execute on function public.create_inquiry(text, text, text, uuid) to anon, authenticated;
revoke execute on function public.enforce_post_rate_limit() from public, anon, authenticated;

commit;
