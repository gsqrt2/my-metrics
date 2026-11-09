-- Step 5: attributes, the metrics measured in a group (spec FR-40 – FR-42, FR-80).
-- Rules that depend on entries (only the owner deletes an attribute with
-- entries; archived attributes are read-only) come with entries in step 6.

create type public.attribute_direction as enum ('higher_better', 'lower_better', 'neutral');

create table public.attributes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null
    check (char_length(name) between 1 and 80 and btrim(name) <> ''), -- FR-80
  -- Free text, no conversion (FR-40); no unit = null.
  unit text check (char_length(unit) <= 20 and btrim(unit) <> ''),
  precision smallint not null default 1 check (precision between 0 and 4),
  direction public.attribute_direction not null default 'neutral',
  -- Optional input limits for new or edited entries (FR-40).
  min_value numeric,
  max_value numeric,
  sort_order integer not null default 0, -- set by set_attribute_defaults on insert
  archived_at timestamptz, -- FR-42
  created_at timestamptz not null default now(),
  constraint attributes_min_max_order check (min_value <= max_value)
);

-- Names are unique within a group, ignoring case and surrounding spaces, so
-- the same metric can't be added twice by accident. Archived ones count too:
-- they can be restored.
create unique index attributes_group_name_key
  on public.attributes (group_id, lower(btrim(name)));
create index attributes_group_sort_idx on public.attributes (group_id, sort_order);

-- What the app may write. sort_order is set by the trigger below on insert and
-- changed through reorder_attributes().
revoke all on public.attributes from anon, authenticated;
grant select on public.attributes to authenticated;
grant insert (id, group_id, name, unit, precision, direction, min_value, max_value)
  on public.attributes to authenticated;
grant update (name, unit, precision, direction, min_value, max_value, archived_at, sort_order)
  on public.attributes to authenticated;
grant delete on public.attributes to authenticated;

alter table public.attributes enable row level security;

create policy "attributes: members see their groups' attributes"
  on public.attributes for select
  to authenticated
  using (public.is_member(group_id));

create policy "attributes: owners and editors add attributes"
  on public.attributes for insert
  to authenticated
  with check (public.member_role(group_id) in ('owner', 'editor'));

create policy "attributes: owners and editors edit, reorder and archive attributes"
  on public.attributes for update
  to authenticated
  using (public.member_role(group_id) in ('owner', 'editor'))
  with check (public.member_role(group_id) in ('owner', 'editor'));

-- §5: owners delete any attribute; editors only those without entries. Until
-- entries exist (step 6) no attribute has any, so both may delete; step 6 adds
-- the entries check.
create policy "attributes: owners and editors delete attributes"
  on public.attributes for delete
  to authenticated
  using (public.member_role(group_id) in ('owner', 'editor'));

-- New attributes go to the end of the list. FR-80: at most 100 per group,
-- archived ones included.
create function public.set_attribute_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serializes concurrent inserts into the same group, so neither the count
  -- nor the sort order can be raced.
  perform 1 from public.groups where id = new.group_id for update;
  if (select count(*) from public.attributes where group_id = new.group_id) >= 100 then
    raise exception using
      errcode = 'P0001',
      message = 'attribute_limit_reached',
      detail = 'A group can have at most 100 attributes (FR-80).';
  end if;
  new.sort_order := coalesce(
    (select max(sort_order) + 1 from public.attributes where group_id = new.group_id),
    0
  );
  return new;
end;
$$;

create trigger set_attribute_defaults
  before insert on public.attributes
  for each row execute function public.set_attribute_defaults();

revoke execute on function public.set_attribute_defaults() from public, anon, authenticated;

-- FR-40: puts a group's attributes in the given order, all at once. Runs with
-- the caller's rights, so RLS decides who may reorder. Attributes left out of
-- the list keep their place after the listed ones.
create function public.reorder_attributes(target_group_id uuid, attribute_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.member_role(target_group_id) is null
    or public.member_role(target_group_id) not in ('owner', 'editor')
  then
    raise exception using errcode = '42501', message = 'not_allowed';
  end if;

  update public.attributes a
  set sort_order = case
    when o.position is not null then o.position::integer - 1
    else array_length(attribute_ids, 1) + a.sort_order
  end
  from public.attributes a2
  left join unnest(attribute_ids) with ordinality as o (id, position) on o.id = a2.id
  where a.id = a2.id and a.group_id = target_group_id;
end;
$$;

revoke execute on function public.reorder_attributes(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_attributes(uuid, uuid[]) to authenticated;
