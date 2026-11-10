-- Step 10: members, roles, ownership and leaving (spec FR-23, FR-24).

-- FR-23: the subject of a member who left with their entries kept, or was
-- removed. Its value visibility can't be changed any more (step 11 uses
-- this), and nobody can be linked to it.
alter table public.subjects add column visibility_frozen boolean not null default false;

-- Frozen subjects can't be requested when joining: the same two functions as
-- in step 9, with "and not s.visibility_frozen" added.
create or replace function public.get_invite_preview(invite_token text)
returns table (
  status text,
  group_id uuid,
  group_name text,
  inviter_name text,
  role public.group_role,
  invite_email text,
  expires_at timestamptz,
  already_member boolean,
  subjects jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  invite public.invites;
  state text;
begin
  select * into invite from public.invites i where i.token = invite_token;
  if not found then
    return query select 'invalid'::text, null::uuid, null::text, null::text,
      null::public.group_role, null::text, null::timestamptz, false, '[]'::jsonb;
    return;
  end if;

  state := public.invite_status(invite);
  if state <> 'valid' then
    return query select state, null::uuid, null::text, null::text,
      null::public.group_role, null::text, null::timestamptz, false, '[]'::jsonb;
    return;
  end if;

  return query
  select
    state,
    g.id,
    g.name,
    p.display_name,
    invite.role,
    invite.email,
    invite.expires_at,
    exists (
      select 1 from public.memberships m
      where m.group_id = g.id and m.user_id = (select auth.uid())
    ),
    coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name) order by s.name)
      from public.subjects s
      where s.group_id = g.id
        and s.linked_user_id is null
        and s.archived_at is null
        and not s.visibility_frozen
        and not exists (
          select 1 from public.subject_link_requests r
          where r.subject_id = s.id and r.status = 'pending'
        )
    ), '[]'::jsonb)
  from public.groups g
  left join public.profiles p on p.id = invite.created_by
  where g.id = invite.group_id;
end;
$$;

create or replace function public.accept_invite(
  invite_token text,
  choice text,
  request_subject_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  invite public.invites;
  my_name text;
begin
  if me is null then
    raise exception using errcode = '42501', message = 'not_signed_in';
  end if;

  select * into invite from public.invites i where i.token = invite_token for update;
  if not found or public.invite_status(invite) <> 'valid' then
    raise exception using errcode = 'P0001', message = 'invite_invalid';
  end if;
  if invite.email is not null and lower(invite.email) <> lower(
    (select u.email from auth.users u where u.id = me)
  ) then
    raise exception using errcode = 'P0001', message = 'invite_for_other_email';
  end if;
  if exists (
    select 1 from public.memberships m where m.group_id = invite.group_id and m.user_id = me
  ) then
    raise exception using errcode = 'P0001', message = 'already_member';
  end if;
  if choice not in ('new', 'request', 'none') then
    raise exception using errcode = '22023', message = 'invalid_choice';
  end if;

  insert into public.memberships (group_id, user_id, role)
  values (invite.group_id, me, invite.role);

  if choice = 'new' then
    select p.display_name into my_name from public.profiles p where p.id = me;
    insert into public.subjects (group_id, name, linked_user_id)
    values (invite.group_id, my_name, me);
  elsif choice = 'request' then
    if not exists (
      select 1 from public.subjects s
      where s.id = request_subject_id
        and s.group_id = invite.group_id
        and s.linked_user_id is null
        and s.archived_at is null
        and not s.visibility_frozen
    ) or exists (
      select 1 from public.subject_link_requests r
      where r.subject_id = request_subject_id and r.status = 'pending'
    ) then
      raise exception using errcode = 'P0001', message = 'subject_unavailable';
    end if;
    insert into public.subject_link_requests (group_id, subject_id, user_id)
    values (invite.group_id, request_subject_id, me);
  end if;

  if invite.email is not null then
    update public.invites set accepted_at = now() where id = invite.id;
  end if;
  return invite.group_id;
end;
$$;

-- FR-23: the owner changes a member's role between editor and viewer. The
-- owner's own role changes only by transferring ownership.
create function public.change_member_role(
  target_group_id uuid,
  target_user_id uuid,
  new_role public.group_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.member_role(target_group_id) is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'not_allowed';
  end if;
  if new_role not in ('editor', 'viewer') then
    raise exception using errcode = '22023', message = 'invalid_role';
  end if;
  update public.memberships
  set role = new_role
  where group_id = target_group_id and user_id = target_user_id and role <> 'owner';
  if not found then
    raise exception using errcode = 'P0001', message = 'not_a_member';
  end if;
end;
$$;

-- What happens to a former member's subject (FR-23): kept (unlinked, its
-- visibility frozen) or deleted with its entries. Their open link requests
-- go either way.
create function public.release_member_subject(
  target_group_id uuid,
  target_user_id uuid,
  keep_entries boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if keep_entries then
    update public.subjects
    set linked_user_id = null, visibility_frozen = true, name_customized = true
    where group_id = target_group_id and linked_user_id = target_user_id;
  else
    delete from public.subjects
    where group_id = target_group_id and linked_user_id = target_user_id;
  end if;
  delete from public.subject_link_requests
  where group_id = target_group_id and user_id = target_user_id and status = 'pending';
end;
$$;

revoke execute on function public.release_member_subject(uuid, uuid, boolean) from public, anon, authenticated;

-- FR-23: the owner removes a member. Their entries stay in the group.
create function public.remove_member(target_group_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.member_role(target_group_id) is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'not_allowed';
  end if;
  delete from public.memberships
  where group_id = target_group_id and user_id = target_user_id and role <> 'owner';
  if not found then
    raise exception using errcode = 'P0001', message = 'not_a_member';
  end if;
  perform public.release_member_subject(target_group_id, target_user_id, true);
end;
$$;

-- FR-23: a member leaves, keeping their entries in the group or deleting
-- them. The owner can't leave (transfer ownership first, FR-24), so nobody
-- can leave their own default group either (FR-13). Members of someone
-- else's default group can.
create function public.leave_group(target_group_id uuid, keep_entries boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  my_role public.group_role := public.member_role(target_group_id);
begin
  if my_role is null then
    raise exception using errcode = 'P0001', message = 'not_a_member';
  end if;
  if my_role = 'owner' then
    raise exception using errcode = 'P0001', message = 'owner_cannot_leave';
  end if;
  delete from public.memberships where group_id = target_group_id and user_id = me;
  perform public.release_member_subject(target_group_id, me, keep_entries);
end;
$$;

-- FR-24: the owner hands the group to another member, and becomes an editor.
-- Not for default groups (FR-13). Done in this order so there's never more
-- than one owner (unique index).
create function public.transfer_ownership(target_group_id uuid, new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
begin
  if public.member_role(target_group_id) is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'not_allowed';
  end if;
  if exists (
    select 1 from public.groups where id = target_group_id and default_for_user_id is not null
  ) then
    raise exception using errcode = 'P0001', message = 'default_group_cannot_transfer';
  end if;
  if new_owner_id = me or not exists (
    select 1 from public.memberships where group_id = target_group_id and user_id = new_owner_id
  ) then
    raise exception using errcode = 'P0001', message = 'not_a_member';
  end if;
  update public.memberships set role = 'editor'
  where group_id = target_group_id and user_id = me;
  update public.memberships set role = 'owner'
  where group_id = target_group_id and user_id = new_owner_id;
end;
$$;

revoke execute on function public.change_member_role(uuid, uuid, public.group_role) from public, anon;
revoke execute on function public.remove_member(uuid, uuid) from public, anon;
revoke execute on function public.leave_group(uuid, boolean) from public, anon;
revoke execute on function public.transfer_ownership(uuid, uuid) from public, anon;
grant execute on function public.change_member_role(uuid, uuid, public.group_role) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.leave_group(uuid, boolean) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
