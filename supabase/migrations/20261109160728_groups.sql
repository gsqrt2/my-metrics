-- Step 3: groups and memberships (spec FR-10 – FR-15, FR-80).
-- Archiving and deleting groups come with step 14, sharing with step 9.

create type public.group_role as enum ('owner', 'editor', 'viewer');

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(name) between 1 and 80 and btrim(name) <> ''), -- FR-80
  description text
    check (char_length(description) <= 500 and btrim(description) <> ''), -- FR-80; no description = null
  -- FR-15: optional duration; both dates or neither.
  starts_on date,
  ends_on date,
  archived_at timestamptz,
  members_edit_own_subject_only boolean not null default false,
  -- FR-13: set only on a user's default ("Personal") group.
  default_for_user_id uuid unique references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint groups_duration_both_or_neither check ((starts_on is null) = (ends_on is null)),
  constraint groups_duration_order check (ends_on >= starts_on)
);

create table public.memberships (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.group_role not null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Exactly one owner per group: at most one by this index, at least one because
-- the owner is added with the group and can't leave (FR-23, steps 9–10).
create unique index memberships_one_owner_per_group
  on public.memberships (group_id) where role = 'owner';
create index memberships_user_id_idx on public.memberships (user_id);

-- Helpers for RLS. `security definer` so policies on memberships can ask about
-- memberships without recursing into their own policy.
create function public.is_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships
    where group_id = target_group_id and user_id = (select auth.uid())
  );
$$;

create function public.member_role(target_group_id uuid)
returns public.group_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.memberships
  where group_id = target_group_id and user_id = (select auth.uid());
$$;

revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.member_role(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.member_role(uuid) to authenticated;

-- What the app may write. Everything else is set by triggers or by SQL
-- functions in later steps:
--   * default_for_user_id only by handle_new_user
--   * archived_at (step 14) and members_edit_own_subject_only (step 12) only by the owner
--   * memberships only through SQL functions (steps 9–10)
-- The app sends its own id when creating a group, so it never needs the new row
-- back: the owner membership that makes the group readable is added by the
-- trigger below, after the insert.
revoke all on public.groups from anon, authenticated;
grant select on public.groups to authenticated;
grant insert (id, name, description, starts_on, ends_on) on public.groups to authenticated;
grant update (name, description, starts_on, ends_on) on public.groups to authenticated;

revoke all on public.memberships from anon, authenticated;
grant select on public.memberships to authenticated;

alter table public.groups enable row level security;
alter table public.memberships enable row level security;

create policy "groups: members read their groups"
  on public.groups for select
  to authenticated
  using (public.is_member(id));

create policy "groups: signed-in users create groups"
  on public.groups for insert
  to authenticated
  with check (default_for_user_id is null);

create policy "groups: owners and editors edit their groups" -- FR-11
  on public.groups for update
  to authenticated
  using (public.member_role(id) in ('owner', 'editor'))
  with check (public.member_role(id) in ('owner', 'editor'));

create policy "memberships: members see who is in their groups"
  on public.memberships for select
  to authenticated
  using (public.is_member(group_id));

-- The creator becomes the owner (FR-10). A default group belongs to the user
-- it's created for, since accounts are created without a signed-in user.
create function public.add_group_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid := coalesce(new.default_for_user_id, (select auth.uid()));
begin
  if owner_id is null then
    raise exception 'A group can only be created by a signed-in user.';
  end if;
  insert into public.memberships (group_id, user_id, role)
  values (new.id, owner_id, 'owner');
  return null;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.add_group_owner();

-- FR-80: a user can be in at most 50 groups, their default group included.
create function public.check_groups_per_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serializes concurrent joins by the same user, so the count can't be raced.
  perform 1 from public.profiles where id = new.user_id for update;
  if (select count(*) from public.memberships where user_id = new.user_id) >= 50 then
    raise exception using
      errcode = 'P0001',
      message = 'group_limit_reached',
      detail = 'A user can be in at most 50 groups (FR-80).';
  end if;
  return new;
end;
$$;

create trigger check_groups_per_user
  before insert on public.memberships
  for each row execute function public.check_groups_per_user();

-- FR-13: a default group can't be deleted while its user exists. It goes when
-- the account does, through the on delete cascade from profiles (FR-3).
create function public.protect_default_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.default_for_user_id is not null
    and exists (select 1 from public.profiles where id = old.default_for_user_id)
  then
    raise exception using
      errcode = 'P0001',
      message = 'default_group_protected',
      detail = 'A default group is only deleted together with its account (FR-13).';
  end if;
  return old;
end;
$$;

create trigger protect_default_group
  before delete on public.groups
  for each row execute function public.protect_default_group();

-- Every new account gets its profile and its default group (FR-13).
-- Step 4 adds the subject linked to the user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        split_part(new.email, '@', 1)
      ),
      80
    )
  );
  insert into public.groups (name, default_for_user_id)
  values ('Personal', new.id);
  return new;
end;
$$;

-- Accounts created before this migration get their default group too.
insert into public.groups (name, default_for_user_id)
select 'Personal', p.id
from public.profiles p
where not exists (select 1 from public.groups g where g.default_for_user_id = p.id);

-- Trigger functions must not be callable through the API.
revoke execute on function public.add_group_owner() from public, anon, authenticated;
revoke execute on function public.check_groups_per_user() from public, anon, authenticated;
revoke execute on function public.protect_default_group() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
