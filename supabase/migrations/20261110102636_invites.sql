-- Step 9: invitations and joining (spec FR-1, FR-20 – FR-22, FR-80).
-- Email invites (the email column) are sent from step 13; accepting already
-- checks the address if an invite has one.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  -- The secret in the link: 24 random URL-safe characters.
  token text not null unique default translate(
    encode(extensions.gen_random_bytes(18), 'base64'), '+/', '-_'
  ),
  role public.group_role not null check (role in ('editor', 'viewer')), -- FR-21
  email text, -- step 13: single use, only for this address
  expires_at timestamptz not null,
  revoked_at timestamptz,
  accepted_at timestamptz, -- email invites only
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index invites_group_id_idx on public.invites (group_id);

create type public.link_request_status as enum ('pending', 'approved', 'rejected');

-- FR-22: someone joining asks to be linked to an existing subject without an
-- account; the owner decides.
create table public.subject_link_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  subject_id uuid not null references public.subjects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.link_request_status not null default 'pending',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- One open request per subject at a time.
create unique index subject_link_requests_one_pending
  on public.subject_link_requests (subject_id) where status = 'pending';

-- What the app may do directly. Joining and deciding requests go through the
-- functions below.
revoke all on public.invites from anon, authenticated;
grant select on public.invites to authenticated;
grant insert (id, group_id, role, expires_at) on public.invites to authenticated;
grant update (revoked_at) on public.invites to authenticated;

revoke all on public.subject_link_requests from anon, authenticated;
grant select on public.subject_link_requests to authenticated;

alter table public.invites enable row level security;
alter table public.subject_link_requests enable row level security;

-- FR-20: owners see all of a group's invites, editors the ones they made.
create policy "invites: owners and their creators see invites"
  on public.invites for select
  to authenticated
  using (
    public.member_role(group_id) = 'owner'
    or (created_by = (select auth.uid()) and public.is_member(group_id))
  );

create policy "invites: owners and editors invite"
  on public.invites for insert
  to authenticated
  with check (public.member_role(group_id) in ('owner', 'editor'));

-- Revoking: the owner any invite, others their own.
create policy "invites: owners and their creators revoke invites"
  on public.invites for update
  to authenticated
  using (
    public.member_role(group_id) = 'owner'
    or (created_by = (select auth.uid()) and public.is_member(group_id))
  )
  with check (
    public.member_role(group_id) = 'owner'
    or (created_by = (select auth.uid()) and public.is_member(group_id))
  );

create policy "subject_link_requests: owners and requesters see requests"
  on public.subject_link_requests for select
  to authenticated
  using (
    public.member_role(group_id) = 'owner' or user_id = (select auth.uid())
  );

-- Who made an invite is recorded by the database, and links expire within
-- 30 days. (Checked here, since a check constraint shouldn't use now().)
create function public.set_invite_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.created_by := (select auth.uid());
  if new.expires_at <= now() or new.expires_at > now() + interval '30 days 1 minute' then
    raise exception using errcode = 'P0001', message = 'invalid_expiry';
  end if;
  return new;
end;
$$;

create trigger set_invite_defaults
  before insert on public.invites
  for each row execute function public.set_invite_defaults();

-- FR-80: at most 50 members per group.
create function public.check_members_per_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serializes concurrent joins of the same group.
  perform 1 from public.groups where id = new.group_id for update;
  if (select count(*) from public.memberships where group_id = new.group_id) >= 50 then
    raise exception using
      errcode = 'P0001',
      message = 'member_limit_reached',
      detail = 'A group can have at most 50 members (FR-80).';
  end if;
  return new;
end;
$$;

create trigger check_members_per_group
  before insert on public.memberships
  for each row execute function public.check_members_per_group();

revoke execute on function public.set_invite_defaults() from public, anon, authenticated;
revoke execute on function public.check_members_per_group() from public, anon, authenticated;

-- An invite's state, as one word.
create function public.invite_status(invite public.invites)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when invite.revoked_at is not null then 'revoked'
    when invite.accepted_at is not null then 'used'
    when invite.expires_at <= now() then 'expired'
    else 'valid'
  end;
$$;

revoke execute on function public.invite_status(public.invites) from public, anon, authenticated;

-- What someone with an invite link may know before joining (FR-20 – FR-22):
-- the group's name, who invited them, the role, and the subjects without an
-- account they could ask to be linked to (names only). Open to everyone with
-- the link, logged in or not. Details are only given for valid invites.
create function public.get_invite_preview(invite_token text)
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

-- Joins the signed-in user to the invite's group with its role (FR-20 –
-- FR-22), then, by choice:
--   'new'     a subject linked to them, named after them
--   'request' a request to be linked to an existing subject without an
--             account (request_subject_id), for the owner to decide
--   'none'    no subject
-- Email invites (step 13) must be accepted with their address, and only once.
create function public.accept_invite(
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

-- FR-22: the owner approves or rejects a request to be linked to a subject.
-- Approving links it, if the subject is still free and the requester is
-- still a member without a subject of their own in the group. The subject
-- keeps its name; it follows the user's display name only if they match.
create function public.decide_link_request(request_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request public.subject_link_requests;
  requester_name text;
begin
  select * into request from public.subject_link_requests r where r.id = request_id for update;
  if not found or public.member_role(request.group_id) is distinct from 'owner' then
    raise exception using errcode = '42501', message = 'not_allowed';
  end if;
  if request.status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'request_not_pending';
  end if;

  if approve then
    if not exists (
      select 1 from public.memberships m
      where m.group_id = request.group_id and m.user_id = request.user_id
    ) or exists (
      select 1 from public.subjects s
      where s.group_id = request.group_id and s.linked_user_id = request.user_id
    ) then
      raise exception using errcode = 'P0001', message = 'subject_unavailable';
    end if;

    select p.display_name into requester_name from public.profiles p where p.id = request.user_id;
    update public.subjects
    set linked_user_id = request.user_id,
        name_customized = name is distinct from requester_name
    where id = request.subject_id and linked_user_id is null and archived_at is null;
    if not found then
      raise exception using errcode = 'P0001', message = 'subject_unavailable';
    end if;
  end if;

  update public.subject_link_requests
  set status = case when approve then 'approved'::public.link_request_status
                    else 'rejected'::public.link_request_status end,
      decided_by = (select auth.uid()),
      decided_at = now()
  where id = request.id;
end;
$$;

revoke execute on function public.get_invite_preview(text) from public;
grant execute on function public.get_invite_preview(text) to anon, authenticated;
revoke execute on function public.accept_invite(text, text, uuid) from public, anon;
grant execute on function public.accept_invite(text, text, uuid) to authenticated;
revoke execute on function public.decide_link_request(uuid, boolean) from public, anon;
grant execute on function public.decide_link_request(uuid, boolean) to authenticated;
