-- Step 6: entries, the logged values (spec FR-50 – FR-54), who may write them
-- (§5), and the attribute rules that depend on entries (FR-42).
-- Value visibility (FR-43) is a stub here that always allows actual values;
-- step 11 makes it real.

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  attribute_id uuid not null references public.attributes (id) on delete cascade,
  value numeric not null,
  measured_at timestamptz not null,
  comment text
    check (char_length(comment) <= 500 and btrim(comment) <> ''), -- FR-80; no comment = null
  -- Set by the trigger below, never by the app. Kept without the person when
  -- their account is deleted (FR-3).
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz,
  -- FR-54: several a day are fine, but not two at the same moment.
  unique (subject_id, attribute_id, measured_at)
);

create index entries_attribute_id_idx on public.entries (attribute_id);

-- Value visibility (FR-43). Step 11 replaces this with the subject's setting.
create function public.visibility_of(target_subject_id uuid, target_attribute_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select 'absolute'::text;
$$;

-- §5: who may log for a subject. Not for archived subjects or groups (FR-32).
-- Linked users always may, viewers included; owners and editors may for any
-- subject unless the group lets members edit only their own.
create function public.can_write_subject(target_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.archived_at is null
      and g.archived_at is null
      and public.is_member(g.id)
      and (
        s.linked_user_id = (select auth.uid())
        or (
          public.member_role(g.id) in ('owner', 'editor')
          and not g.members_edit_own_subject_only
        )
      )
    from public.subjects s
    join public.groups g on g.id = s.group_id
    where s.id = target_subject_id
  ), false);
$$;

-- Who may log a value of an attribute for a subject: they may write the
-- subject, the attribute isn't archived (FR-42), and under "% only" (FR-43) a
-- linked subject's values are written by its user alone.
create function public.can_write_entry(target_subject_id uuid, target_attribute_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_write_subject(target_subject_id)
    and coalesce((
      select a.archived_at is null
        and (
          public.visibility_of(s.id, a.id) = 'absolute'
          or s.linked_user_id is null
          or s.linked_user_id = (select auth.uid())
        )
      from public.attributes a
      join public.subjects s on s.id = target_subject_id
      where a.id = target_attribute_id
    ), false);
$$;

-- Who may see the actual values (FR-43). With the stub above, every member.
create function public.can_see_values(target_subject_id uuid, target_attribute_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select public.is_member(s.group_id)
      and (
        public.visibility_of(s.id, target_attribute_id) = 'absolute'
        or s.linked_user_id = (select auth.uid())
        or (s.linked_user_id is null and public.can_write_subject(s.id))
      )
    from public.subjects s
    where s.id = target_subject_id
  ), false);
$$;

revoke execute on function public.visibility_of(uuid, uuid) from public, anon;
revoke execute on function public.can_write_subject(uuid) from public, anon;
revoke execute on function public.can_write_entry(uuid, uuid) from public, anon;
revoke execute on function public.can_see_values(uuid, uuid) from public, anon;
grant execute on function public.visibility_of(uuid, uuid) to authenticated;
grant execute on function public.can_write_subject(uuid) to authenticated;
grant execute on function public.can_write_entry(uuid, uuid) to authenticated;
grant execute on function public.can_see_values(uuid, uuid) to authenticated;

-- What the app may write. The subject and attribute of an entry are fixed once
-- logged; who and when is set by the trigger.
revoke all on public.entries from anon, authenticated;
grant select on public.entries to authenticated;
grant insert (id, subject_id, attribute_id, value, measured_at, comment)
  on public.entries to authenticated;
grant update (value, measured_at, comment) on public.entries to authenticated;
grant delete on public.entries to authenticated;

alter table public.entries enable row level security;

create policy "entries: members see values they may see"
  on public.entries for select
  to authenticated
  using (public.can_see_values(subject_id, attribute_id));

create policy "entries: log where allowed"
  on public.entries for insert
  to authenticated
  with check (public.can_write_entry(subject_id, attribute_id));

create policy "entries: edit where allowed"
  on public.entries for update
  to authenticated
  using (public.can_write_entry(subject_id, attribute_id))
  with check (public.can_write_entry(subject_id, attribute_id));

create policy "entries: delete where allowed" -- FR-52
  on public.entries for delete
  to authenticated
  using (public.can_write_entry(subject_id, attribute_id));

-- Checks and bookkeeping for every new or changed entry.
create function public.check_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  attribute public.attributes;
begin
  -- The app can only change the value, time and comment. An update that
  -- changes none of them is the database's own, e.g. clearing created_by when
  -- an account is deleted (FR-3), and must go through untouched.
  if tg_op = 'UPDATE'
    and new.value = old.value
    and new.measured_at = old.measured_at
    and new.comment is not distinct from old.comment
  then
    return new;
  end if;

  select * into attribute from public.attributes where id = new.attribute_id;

  -- The subject and the attribute belong to the same group.
  if attribute.group_id is distinct from (
    select group_id from public.subjects where id = new.subject_id
  ) then
    raise exception using errcode = 'P0001', message = 'entry_group_mismatch';
  end if;

  -- FR-53: no future times. A few minutes of clock skew are allowed.
  if new.measured_at > now() + interval '5 minutes' then
    raise exception using errcode = 'P0001', message = 'measured_at_in_future';
  end if;

  -- FR-40: min/max apply to new values and changed values only, so entries
  -- logged before a limit was set can still have their comment edited.
  if tg_op = 'INSERT' or new.value is distinct from old.value then
    if new.value < attribute.min_value or new.value > attribute.max_value then
      raise exception using
        errcode = 'P0001',
        message = 'value_out_of_range',
        detail = format('%s must be between %s and %s.',
          attribute.name, attribute.min_value, attribute.max_value);
    end if;
  end if;

  -- FR-50: who logged it and who last changed it, never taken from the app.
  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    new.created_at := now();
    new.updated_by := null;
    new.updated_at := null;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_by := (select auth.uid());
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger check_entry
  before insert or update on public.entries
  for each row execute function public.check_entry();

revoke execute on function public.check_entry() from public, anon, authenticated;

-- FR-42: only the owner deletes an attribute that has entries. Counts every
-- entry, also ones the caller can't see (FR-43).
create function public.attribute_has_entries(target_attribute_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.entries where attribute_id = target_attribute_id);
$$;

revoke execute on function public.attribute_has_entries(uuid) from public, anon;
grant execute on function public.attribute_has_entries(uuid) to authenticated;

drop policy "attributes: owners and editors delete attributes" on public.attributes;
create policy "attributes: owners delete attributes, editors only those without entries"
  on public.attributes for delete
  to authenticated
  using (
    public.member_role(group_id) = 'owner'
    or (
      public.member_role(group_id) = 'editor'
      and not public.attribute_has_entries(id)
    )
  );

-- Entries show who logged them (FR-50), so members of a shared group can read
-- each other's display names. Profiles hold nothing else.
create function public.shares_group_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.group_id = mine.group_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target_user_id
  );
$$;

revoke execute on function public.shares_group_with(uuid) from public, anon;
grant execute on function public.shares_group_with(uuid) to authenticated;

create policy "profiles: members read the profiles of people they share a group with"
  on public.profiles for select
  to authenticated
  using (public.shares_group_with(id));
