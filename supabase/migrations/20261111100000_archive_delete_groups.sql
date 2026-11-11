-- Step 14: archiving and deleting groups (FR-11, FR-13).
--
-- An archived group is read-only for everyone: nothing in it is added,
-- changed or deleted until the owner restores it. Members can still leave or
-- be removed, roles can change, ownership can move, and the CSV export works.
-- Entries and value visibility already check the group (can_write_subject);
-- the rest is guarded here.

create function public.is_group_archived(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select archived_at is not null from public.groups where id = target_group_id),
    false
  );
$$;

revoke execute on function public.is_group_archived(uuid) from public, anon, authenticated;

-- Writes the app makes directly (as `authenticated`) to a group's subjects,
-- attributes and invites. The SQL functions (leaving, removing, ...) run as
-- their owner and decide themselves what they may do in an archived group.
--
-- Runs as the caller (not security definer), so current_user tells the app's
-- writes from the functions'. The group is read under the caller's RLS: a
-- group they can't see isn't theirs to write to anyway.
create function public.refuse_writes_when_archived()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target uuid;
begin
  if current_user <> 'authenticated' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    target := old.group_id;
  else
    target := new.group_id;
  end if;
  if exists (
    select 1 from public.groups g
    where g.id = target and g.archived_at is not null
  ) then
    raise exception using errcode = 'P0001', message = 'group_archived';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger refuse_writes_when_archived
  before insert or update or delete on public.subjects
  for each row execute function public.refuse_writes_when_archived();
create trigger refuse_writes_when_archived
  before insert or update or delete on public.attributes
  for each row execute function public.refuse_writes_when_archived();
create trigger refuse_writes_when_archived
  before insert or update or delete on public.invites
  for each row execute function public.refuse_writes_when_archived();

-- Name, description and duration of an archived group stay as they are.
-- As the caller, like the trigger above.
create function public.refuse_group_edits_when_archived()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and old.archived_at is not null then
    raise exception using errcode = 'P0001', message = 'group_archived';
  end if;
  return new;
end;
$$;

create trigger refuse_group_edits_when_archived
  before update on public.groups
  for each row execute function public.refuse_group_edits_when_archived();

-- Nobody joins an archived group, and no one is linked to a subject in it,
-- whichever way it's attempted.
create function public.refuse_joining_when_archived()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_group_archived(new.group_id) then
    raise exception using errcode = 'P0001', message = 'group_archived';
  end if;
  return new;
end;
$$;

create trigger refuse_joining_when_archived
  before insert on public.memberships
  for each row execute function public.refuse_joining_when_archived();
create trigger refuse_joining_when_archived
  before insert on public.subject_link_requests
  for each row execute function public.refuse_joining_when_archived();
create trigger refuse_approving_when_archived
  before update on public.subject_link_requests
  for each row
  when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.refuse_joining_when_archived();

revoke execute on function public.refuse_joining_when_archived() from public, anon, authenticated;

-- The owner's setting (step 12) is part of the group, so also frozen.
create or replace function public.set_members_edit_own_subject_only(
  target_group_id uuid,
  enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.member_role(target_group_id) is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'not_owner';
  end if;
  if enabled is null then
    raise exception using errcode = '22004', message = 'enabled_required';
  end if;
  if public.is_group_archived(target_group_id) then
    raise exception using errcode = 'P0001', message = 'group_archived';
  end if;
  update public.groups
  set members_edit_own_subject_only = enabled
  where id = target_group_id;
end;
$$;

-- FR-11: the owner archives or restores a group. The default group stays
-- active (FR-13: every user always has a group to log in). Archiving
-- withdraws the open invites; restoring doesn't bring them back.
create function public.set_group_archived(target_group_id uuid, archived boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.member_role(target_group_id) is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'not_owner';
  end if;
  if archived is null then
    raise exception using errcode = '22004', message = 'archived_required';
  end if;
  if exists (
    select 1 from public.groups
    where id = target_group_id and default_for_user_id is not null
  ) then
    raise exception using errcode = 'P0001', message = 'default_group';
  end if;

  update public.groups
  set archived_at = case
    when archived then coalesce(archived_at, now())
    else null
  end
  where id = target_group_id;

  if archived then
    update public.invites
    set revoked_at = now()
    where group_id = target_group_id
      and revoked_at is null
      and accepted_at is null
      and expires_at > now();
  end if;
end;
$$;

-- FR-11: the owner deletes a group, with everything in it, for all members.
-- Not the default group (FR-13): it goes with the account.
create function public.delete_group(target_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.member_role(target_group_id) is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'not_owner';
  end if;
  if exists (
    select 1 from public.groups
    where id = target_group_id and default_for_user_id is not null
  ) then
    raise exception using errcode = 'P0001', message = 'default_group';
  end if;
  delete from public.groups where id = target_group_id;
end;
$$;

revoke execute on function public.set_group_archived(uuid, boolean) from public, anon;
revoke execute on function public.delete_group(uuid) from public, anon;
grant execute on function public.set_group_archived(uuid, boolean) to authenticated;
grant execute on function public.delete_group(uuid) to authenticated;
