-- Step 13: invites by email (FR-20). The send-invite Edge Function creates
-- them as the signed-in user, then mails the link. Accepting already checks
-- the address and uses them up (step 9).

grant insert (email) on public.invites to authenticated;

alter table public.invites
  add constraint invites_email_format
  check (
    email is null
    or (
      email = lower(btrim(email))
      and email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
      and length(email) <= 254
    )
  );

-- For an email invite: not for someone who's already a member, at most 20 a
-- day per sender (against misuse as a mail relay), and an earlier open invite
-- to the same address in the group is withdrawn, so only the newest works.
create function public.check_email_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null then
    return new;
  end if;
  if exists (
    select 1
    from public.memberships m
    join auth.users u on u.id = m.user_id
    where m.group_id = new.group_id and lower(u.email) = new.email
  ) then
    raise exception using errcode = 'P0001', message = 'already_member';
  end if;
  if (
    select count(*) from public.invites
    where created_by = new.created_by
      and email is not null
      and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception using errcode = 'P0001', message = 'email_invite_limit';
  end if;
  update public.invites
  set revoked_at = now()
  where group_id = new.group_id
    and email = new.email
    and revoked_at is null
    and accepted_at is null;
  return new;
end;
$$;

-- Runs after set_invite_defaults, which sets created_by: triggers of the
-- same kind run in name order.
create trigger t_check_email_invite
  before insert on public.invites
  for each row execute function public.check_email_invite();

revoke execute on function public.check_email_invite() from public, anon, authenticated;
