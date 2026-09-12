begin;

create or replace function public.get_participation_messages(p_participation_id uuid, p_guest_id uuid default null)
returns table(id uuid, body text, sender_role text, is_mine boolean, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_p public.participations%rowtype;
  v_author_id uuid;
  v_role text;
begin
  select p.* into v_p from public.participations p where p.id = p_participation_id;
  if v_p.id is null then raise exception '応募が見つかりません'; end if;
  if v_p.post_type = 'practice' then select x.author_id into v_author_id from public.practice_posts x where x.id = v_p.post_id;
  elsif v_p.post_type = 'member' then select x.author_id into v_author_id from public.member_posts x where x.id = v_p.post_id;
  else select x.author_id into v_author_id from public.event_posts x where x.id = v_p.post_id; end if;
  if auth.uid() is not null and (auth.uid() = v_author_id or public.is_admin()) then v_role := 'organizer';
  elsif (auth.uid() is not null and auth.uid() = v_p.user_id) or (p_guest_id is not null and p_guest_id = v_p.guest_id) then v_role := 'applicant';
  else raise exception 'メッセージを確認する権限がありません'; end if;

  update public.messages m set read_at = now()
  where m.participation_id = p_participation_id and m.sender_role <> v_role and m.read_at is null;
  return query select m.id, m.body, m.sender_role, m.sender_role = v_role, m.created_at
    from public.messages m where m.participation_id = p_participation_id order by m.created_at;
end;
$$;

revoke execute on function public.get_participation_messages(uuid, uuid) from public;
grant execute on function public.get_participation_messages(uuid, uuid) to anon, authenticated;

commit;
