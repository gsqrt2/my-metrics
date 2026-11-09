-- Step 7: reading a group's entries for its charts and dashboard (spec FR-60).
-- Both functions check membership themselves and apply value visibility
-- (FR-43) per row: hidden rows carry only the % change. Until step 11 every
-- value is visible (visibility_of is a stub).

-- Every entry of a group in a time range, oldest first, with the % change
-- since the subject's first entry for that attribute ("first entry" baseline;
-- step 8 adds "since the group's start"). The baseline is the first entry
-- ever, not the first in the range, so % changes don't depend on the range.
-- A baseline of 0 gives no % change ("n/a").
create function public.get_series(
  target_group_id uuid,
  from_at timestamptz default null,
  to_at timestamptz default null
)
returns table (
  entry_id uuid,
  subject_id uuid,
  attribute_id uuid,
  measured_at timestamptz,
  value numeric,
  pct_change numeric,
  comment text
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

  return query
  with ranked as (
    select
      e.id, e.subject_id, e.attribute_id, e.measured_at, e.value, e.comment,
      first_value(e.value) over (
        partition by e.subject_id, e.attribute_id order by e.measured_at
      ) as baseline
    from public.entries e
    join public.subjects s on s.id = e.subject_id
    where s.group_id = target_group_id
  )
  select
    r.id,
    r.subject_id,
    r.attribute_id,
    r.measured_at,
    case when public.can_see_values(r.subject_id, r.attribute_id) then r.value end,
    case when r.baseline <> 0
      then round((r.value - r.baseline) / abs(r.baseline) * 100, 2)
    end,
    r.comment
  from ranked r
  where (from_at is null or r.measured_at >= from_at)
    and (to_at is null or r.measured_at <= to_at)
  order by r.measured_at, r.subject_id, r.attribute_id;
end;
$$;

-- Per subject and attribute: the first, previous and latest entry and how
-- many there are, so the dashboard needn't load years of entries for its
-- numbers. Changes are the latest minus the previous and minus the first.
create function public.get_dashboard(target_group_id uuid)
returns table (
  subject_id uuid,
  attribute_id uuid,
  entry_count integer,
  first_at timestamptz,
  first_value numeric,
  previous_at timestamptz,
  previous_value numeric,
  latest_at timestamptz,
  latest_value numeric,
  change_since_previous numeric,
  change_since_first numeric,
  pct_since_previous numeric,
  pct_since_first numeric
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

  return query
  with numbered as (
    select
      e.subject_id, e.attribute_id, e.measured_at, e.value,
      row_number() over w_desc as from_latest,
      count(*) over (partition by e.subject_id, e.attribute_id) as total,
      first_value(e.value) over w_asc as first_value,
      first_value(e.measured_at) over w_asc as first_at
    from public.entries e
    join public.subjects s on s.id = e.subject_id
    where s.group_id = target_group_id
    window
      w_desc as (partition by e.subject_id, e.attribute_id order by e.measured_at desc),
      w_asc as (partition by e.subject_id, e.attribute_id order by e.measured_at)
  ),
  summary as (
    select
      n.subject_id, n.attribute_id,
      max(n.total)::integer as total,
      max(n.first_at) as first_at,
      max(n.first_value) as first_value,
      max(n.measured_at) filter (where n.from_latest = 2) as previous_at,
      max(n.value) filter (where n.from_latest = 2) as previous_value,
      max(n.measured_at) filter (where n.from_latest = 1) as latest_at,
      max(n.value) filter (where n.from_latest = 1) as latest_value
    from numbered n
    group by n.subject_id, n.attribute_id
  )
  select
    m.subject_id,
    m.attribute_id,
    m.total,
    m.first_at,
    case when m.visible then m.first_value end,
    m.previous_at,
    case when m.visible then m.previous_value end,
    m.latest_at,
    case when m.visible then m.latest_value end,
    case when m.visible then m.latest_value - m.previous_value end,
    case when m.visible then m.latest_value - m.first_value end,
    case when m.previous_value <> 0
      then round((m.latest_value - m.previous_value) / abs(m.previous_value) * 100, 2)
    end,
    case when m.first_value <> 0
      then round((m.latest_value - m.first_value) / abs(m.first_value) * 100, 2)
    end
  from (
    select su.*, public.can_see_values(su.subject_id, su.attribute_id) as visible
    from summary su
  ) m;
end;
$$;

revoke execute on function public.get_series(uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.get_dashboard(uuid) from public, anon;
grant execute on function public.get_series(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_dashboard(uuid) to authenticated;
