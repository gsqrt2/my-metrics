-- Backlog: "Track myself here" for members who aren't a participant yet.
--
-- Joining through an invite can add the new member as a linked participant
-- (accept_invite), but the creator of a group, and members who joined with
-- "Just watch", had no way to become one. linked_user_id isn't writable by
-- the app, so this function adds the caller's own linked participant: named
-- after their display name (and following it, FR-33), coloured by
-- set_subject_defaults.

create function public.track_myself(target_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_name text;
  new_subject_id uuid;
begin
  if not public.is_member(target_group_id) then
    raise exception using errcode = 'P0001', message = 'not_allowed';
  end if;
  -- Runs as the owner of this function, which the archive guards let
  -- through, so archived groups are checked here (FR-11).
  if exists (
    select 1 from public.groups g where g.id = target_group_id and g.archived_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'group_archived';
  end if;
  if exists (
    select 1 from public.subjects s where s.group_id = target_group_id and s.linked_user_id = me
  ) then
    raise exception using errcode = 'P0001', message = 'already_tracked';
  end if;
  -- Waiting to be linked to an existing participant (FR-22): one or the other.
  if exists (
    select 1 from public.subject_link_requests r
    where r.group_id = target_group_id and r.user_id = me and r.status = 'pending'
  ) then
    raise exception using errcode = 'P0001', message = 'link_request_pending';
  end if;

  select p.display_name into my_name from public.profiles p where p.id = me;
  insert into public.subjects (group_id, name, linked_user_id)
  values (target_group_id, my_name, me)
  returning id into new_subject_id;
  return new_subject_id;
end;
$$;

revoke execute on function public.track_myself(uuid) from public, anon;
grant execute on function public.track_myself(uuid) to authenticated;
