-- Step 4: subjects, who or what is measured in a group (spec FR-13, FR-30 – FR-33).
-- Linking a subject to someone joining comes with invites (step 9), the
-- frozen visibility of former members' subjects with step 10.

-- The categorical chart palette, in its fixed order (src/features/subjects/colors.ts
-- has the light and dark values). A subject keeps its colour everywhere.
create type public.subject_color as enum (
  'blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red'
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null
    check (char_length(name) between 1 and 80 and btrim(name) <> ''), -- FR-80
  -- A plain calendar date. "Not in the future" is checked in the app, since a
  -- check constraint shouldn't depend on today's date.
  birthdate date check (birthdate >= '1900-01-01'),
  color public.subject_color not null,
  -- FR-31: at most one subject per user and group. Deleting the account
  -- deletes the user's linked subjects with their entries (FR-3).
  linked_user_id uuid references public.profiles (id) on delete cascade,
  -- FR-33: set once a linked subject is renamed in its group; it then stops
  -- following the user's display name.
  name_customized boolean not null default false,
  archived_at timestamptz, -- FR-32
  created_at timestamptz not null default now(),
  unique (group_id, linked_user_id)
);

create index subjects_linked_user_id_idx on public.subjects (linked_user_id);

-- What the app may write. linked_user_id is only set by handle_new_user here
-- and by accepting an invite (step 9); name_customized only by the trigger below.
revoke all on public.subjects from anon, authenticated;
grant select on public.subjects to authenticated;
grant insert (id, group_id, name, birthdate, color) on public.subjects to authenticated;
grant update (name, birthdate, color, archived_at) on public.subjects to authenticated;

alter table public.subjects enable row level security;

create policy "subjects: members see their groups' subjects"
  on public.subjects for select
  to authenticated
  using (public.is_member(group_id));

-- §5: owners and editors manage subjects, also when the group setting
-- "Members can only edit their own subject" is on.
create policy "subjects: owners and editors add subjects"
  on public.subjects for insert
  to authenticated
  with check (public.member_role(group_id) in ('owner', 'editor'));

create policy "subjects: owners and editors edit and archive subjects"
  on public.subjects for update
  to authenticated
  using (public.member_role(group_id) in ('owner', 'editor'))
  with check (public.member_role(group_id) in ('owner', 'editor'));

-- No delete policy: subjects are archived (FR-30, FR-32). They're deleted only
-- with their group or their linked account, or when a member leaves (step 10).

-- A subject added without a colour gets the one used least in its group,
-- earliest in the palette order on a tie.
create function public.set_subject_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.color is null then
    select c.color into new.color
    from unnest(enum_range(null::public.subject_color)) with ordinality as c (color, position)
    order by
      (select count(*) from public.subjects s where s.group_id = new.group_id and s.color = c.color),
      c.position
    limit 1;
  end if;
  return new;
end;
$$;

create trigger set_subject_defaults
  before insert on public.subjects
  for each row execute function public.set_subject_defaults();

-- FR-33: renaming a linked subject stops it following the display name.
-- Renaming it back to the display name makes it follow again.
create function public.track_subject_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.linked_user_id is not null and new.name is distinct from old.name then
    new.name_customized := new.name is distinct from (
      select display_name from public.profiles where id = new.linked_user_id
    );
  end if;
  return new;
end;
$$;

create trigger track_subject_name
  before update on public.subjects
  for each row execute function public.track_subject_name();

-- FR-33: a new display name is passed on to the user's linked subjects that
-- haven't been renamed in their group.
create function public.follow_display_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.subjects
  set name = new.display_name
  where linked_user_id = new.id and not name_customized;
  return null;
end;
$$;

create trigger follow_display_name
  after update of display_name on public.profiles
  for each row
  when (new.display_name is distinct from old.display_name)
  execute function public.follow_display_name();

-- FR-13: every new account gets its profile, its default group and, in that
-- group, a subject linked to the user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_display_name text := left(
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    ),
    80
  );
  default_group_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, user_display_name);

  insert into public.groups (name, default_for_user_id)
  values ('Personal', new.id)
  returning id into default_group_id;

  insert into public.subjects (group_id, name, linked_user_id)
  values (default_group_id, user_display_name, new.id);
  return new;
end;
$$;

-- Default groups created before this migration get their linked subject too.
insert into public.subjects (group_id, name, linked_user_id)
select g.id, p.display_name, p.id
from public.groups g
join public.profiles p on p.id = g.default_for_user_id
where not exists (
  select 1 from public.subjects s where s.group_id = g.id and s.linked_user_id = p.id
);

-- Trigger functions must not be callable through the API.
revoke execute on function public.set_subject_defaults() from public, anon, authenticated;
revoke execute on function public.track_subject_name() from public, anon, authenticated;
revoke execute on function public.follow_display_name() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
