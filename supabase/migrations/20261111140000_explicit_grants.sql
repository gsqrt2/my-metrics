-- Step 16: rights that relied on the default privileges.
--
-- With nothing granted by default (20261106000000_no_default_privileges.sql,
-- and "Automatically expose new tables" off in the cloud project), these have
-- to be granted explicitly.

-- Profiles: users read and rename (FR-80); rows come and go with the auth user.
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;

-- The Edge Functions' admin client (service_role, which bypasses RLS):
--   delete-account lists the groups the user owns
grant select on public.memberships, public.groups to service_role;
--   send-invite withdraws an invite whose email couldn't be sent
grant select, delete on public.invites to service_role;
--   redeem-invite checks the invite before creating the account
grant execute on function public.get_invite_preview(text) to service_role;
