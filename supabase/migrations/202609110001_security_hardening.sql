begin;

-- RLS controls which rows can be updated, but column privileges control what can
-- be changed. Users may edit only the public profile fields, never role or email.
revoke insert, update, delete on table public.users from anon, authenticated;
grant update (display_name, prefecture, level) on table public.users to authenticated;

-- New accounts must never become administrators based only on signup order.
-- Existing administrator assignments are preserved by this replacement.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users(id, email, display_name, role)
  values(
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      split_part(coalesce(new.email, 'member'), '@', 1)
    ),
    'user'
  );
  return new;
end;
$$;

-- SECURITY DEFINER functions should be callable only by the roles that need them.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.cleanup_post_participations() from public, anon, authenticated;

revoke execute on function public.join_post(text, uuid) from public, anon;
grant execute on function public.join_post(text, uuid) to authenticated;

revoke execute on function public.get_post_participation_counts() from public;
grant execute on function public.get_post_participation_counts() to anon, authenticated;

commit;
