-- Step 12: the group setting "Members can only edit their own subject" (§5).
-- Only the owner changes it, so it isn't in the column grants for updates
-- (editors may update the group too). A new group may start with it on: its
-- creator is its owner.

grant insert (members_edit_own_subject_only) on public.groups to authenticated;

create function public.set_members_edit_own_subject_only(
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
  update public.groups
  set members_edit_own_subject_only = enabled
  where id = target_group_id;
end;
$$;

revoke execute on function public.set_members_edit_own_subject_only(uuid, boolean) from public, anon;
grant execute on function public.set_members_edit_own_subject_only(uuid, boolean) to authenticated;
