-- Step 15: deleting an account (FR-3).
--
-- The delete-account Edge Function deletes the auth user; the foreign keys do
-- the rest: the profile, the default group (with everything in it), the
-- memberships, the linked subjects with their entries and settings, and the
-- user's name on entries logged for others (set to null).
--
-- What's missing is a guard: a group the user owns (other than the default
-- group) would be left without an owner. The function checks first and says
-- which groups; this trigger makes sure, whoever deletes the account.

create function public.refuse_deleting_group_owners()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.memberships m
    join public.groups g on g.id = m.group_id
    where m.user_id = old.id
      and m.role = 'owner'
      and g.default_for_user_id is distinct from old.id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'owns_groups',
      detail = 'Transfer or delete the groups the user owns first (FR-3).';
  end if;
  return old;
end;
$$;

create trigger refuse_deleting_group_owners
  before delete on public.profiles
  for each row execute function public.refuse_deleting_group_owners();

revoke execute on function public.refuse_deleting_group_owners() from public, anon, authenticated;
