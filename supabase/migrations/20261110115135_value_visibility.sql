-- Step 11: value visibility (spec FR-43). Per subject and attribute, other
-- members see the actual values or only the % change. Who decides: the linked
-- user for their own subject; for a subject without an account, whoever may
-- log for it; for a former member's (frozen) subject, nobody. Nobody can
-- override it, the owner included. Comments and dates stay visible.

create type public.value_visibility_mode as enum ('absolute', 'relative');

-- No row means 'absolute' (actual values), the default.
create table public.value_visibility (
  subject_id uuid not null references public.subjects (id) on delete cascade,
  attribute_id uuid not null references public.attributes (id) on delete cascade,
  visibility public.value_visibility_mode not null,
  updated_at timestamptz not null default now(),
  primary key (subject_id, attribute_id)
);

create index value_visibility_attribute_id_idx on public.value_visibility (attribute_id);

-- The group of a subject, for policies (security definer: no recursion
-- through the subjects policy).
create function public.subject_group_id(target_subject_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select group_id from public.subjects where id = target_subject_id;
$$;

revoke execute on function public.subject_group_id(uuid) from public, anon;
grant execute on function public.subject_group_id(uuid) to authenticated;

-- The real setting; replaces the step 6 stub.
create or replace function public.visibility_of(target_subject_id uuid, target_attribute_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select v.visibility::text from public.value_visibility v
    where v.subject_id = target_subject_id and v.attribute_id = target_attribute_id
  ), 'absolute');
$$;

-- As in step 6, plus: a former member's (frozen) subject is read-only. Its
-- history stays, but nobody continues it (decided 2026-11-10).
create or replace function public.can_write_subject(target_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.archived_at is null
      and not s.visibility_frozen
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

-- Who sees the actual values of a subject's attribute: every member when the
-- setting is "actual values"; otherwise only the one who decides it (the
-- linked user, or for a subject without an account those who may log for
-- it). Nobody for a former member's subject set to "% only".
create or replace function public.can_see_values(target_subject_id uuid, target_attribute_id uuid)
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
        or (
          s.linked_user_id is null
          and not s.visibility_frozen
          and public.can_write_subject(s.id)
        )
      )
    from public.subjects s
    where s.id = target_subject_id
  ), false);
$$;

-- Who may change a subject's settings: the linked user, or for a subject
-- without an account those who may log for it. Never for frozen subjects.
-- The owner role grants nothing extra here.
create function public.can_set_visibility(target_subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select not s.visibility_frozen
      and public.is_member(s.group_id)
      and (
        s.linked_user_id = (select auth.uid())
        or (s.linked_user_id is null and public.can_write_subject(s.id))
      )
    from public.subjects s
    where s.id = target_subject_id
  ), false);
$$;

revoke execute on function public.can_set_visibility(uuid) from public, anon;
grant execute on function public.can_set_visibility(uuid) to authenticated;

-- The subject and attribute of a setting belong to the same group.
create function public.check_value_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.subject_group_id(new.subject_id) is distinct from (
    select group_id from public.attributes where id = new.attribute_id
  ) then
    raise exception using errcode = 'P0001', message = 'visibility_group_mismatch';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger check_value_visibility
  before insert or update on public.value_visibility
  for each row execute function public.check_value_visibility();

revoke execute on function public.check_value_visibility() from public, anon, authenticated;

revoke all on public.value_visibility from anon, authenticated;
grant select on public.value_visibility to authenticated;
grant insert (subject_id, attribute_id, visibility) on public.value_visibility to authenticated;
grant update (visibility) on public.value_visibility to authenticated;
grant delete on public.value_visibility to authenticated;

alter table public.value_visibility enable row level security;

-- Members see the settings (so the app can mark values as "% only").
create policy "value_visibility: members see the settings"
  on public.value_visibility for select
  to authenticated
  using (public.is_member(public.subject_group_id(subject_id)));

create policy "value_visibility: deciders set it"
  on public.value_visibility for insert
  to authenticated
  with check (public.can_set_visibility(subject_id));

create policy "value_visibility: deciders change it"
  on public.value_visibility for update
  to authenticated
  using (public.can_set_visibility(subject_id))
  with check (public.can_set_visibility(subject_id));

create policy "value_visibility: deciders reset it"
  on public.value_visibility for delete
  to authenticated
  using (public.can_set_visibility(subject_id));

-- FR-65, FR-66: a group's entries for the entry lists, with hidden values
-- given as their % change since the subject's first entry (FR-43), like
-- get_series. Rows of every entry, so hidden ones still appear (with their
-- date and comment). Filtered by subject and attribute, sorted, paged, with
-- the total. Sorting by value only uses values the viewer may see; hidden ones
-- come last, so the order reveals nothing.
create function public.get_entry_rows(
  target_group_id uuid,
  subject_filter uuid default null,
  attribute_filter uuid default null,
  sort text default 'newest',
  page_size integer default 50,
  page_offset integer default 0
)
returns table (
  entry_id uuid,
  subject_id uuid,
  attribute_id uuid,
  measured_at timestamptz,
  value numeric,
  pct_change numeric,
  comment text,
  created_at timestamptz,
  updated_at timestamptz,
  creator_name text,
  updater_name text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_member(target_group_id) then
    raise exception using errcode = '42501', message = 'not_a_member';
  end if;
  if sort not in ('newest', 'oldest', 'highest', 'lowest') then
    raise exception using errcode = '22023', message = 'invalid_sort';
  end if;

  return query
  with all_entries as (
    select
      e.*,
      first_value(e.value) over (
        partition by e.subject_id, e.attribute_id order by e.measured_at
      ) as baseline,
      public.can_see_values(e.subject_id, e.attribute_id) as visible
    from public.entries e
    join public.subjects s on s.id = e.subject_id
    where s.group_id = target_group_id
  ),
  chosen as (
    select a.*, count(*) over () as total
    from all_entries a
    where (subject_filter is null or a.subject_id = subject_filter)
      and (attribute_filter is null or a.attribute_id = attribute_filter)
  )
  select
    c.id,
    c.subject_id,
    c.attribute_id,
    c.measured_at,
    case when c.visible then c.value end,
    case when c.baseline <> 0 then round((c.value - c.baseline) / abs(c.baseline) * 100, 2) end,
    c.comment,
    c.created_at,
    c.updated_at,
    creator.display_name,
    updater.display_name,
    c.total
  from chosen c
  left join public.profiles creator on creator.id = c.created_by
  left join public.profiles updater on updater.id = c.updated_by
  order by
    case when sort = 'highest' then case when c.visible then c.value end end desc nulls last,
    case when sort = 'lowest' then case when c.visible then c.value end end asc nulls last,
    case when sort = 'oldest' then c.measured_at end asc,
    c.measured_at desc,
    c.id
  limit page_size offset page_offset;
end;
$$;

-- How many entries an attribute has, for the warnings on editing or deleting
-- it (FR-41, FR-42); hidden ones included, as a number only.
create function public.attribute_entry_count(target_attribute_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_member((select group_id from public.attributes where id = target_attribute_id))
    then (select count(*)::integer from public.entries where attribute_id = target_attribute_id)
  end;
$$;

revoke execute on function public.get_entry_rows(uuid, uuid, uuid, text, integer, integer) from public, anon;
revoke execute on function public.attribute_entry_count(uuid) from public, anon;
grant execute on function public.get_entry_rows(uuid, uuid, uuid, text, integer, integer) to authenticated;
grant execute on function public.attribute_entry_count(uuid) to authenticated;
