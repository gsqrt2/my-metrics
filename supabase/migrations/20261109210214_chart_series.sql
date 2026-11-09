-- Step 8: get_series for the full-screen charts (spec FR-61 – FR-64): a
-- choice of baseline, the change in the attribute's unit, and grouping of
-- large volumes so a chart never gets more points than it can show.

drop function public.get_series(uuid, timestamptz, timestamptz);

-- Every entry of a group in a time range, oldest first. Per point:
--   value       the actual value, or null if hidden from the viewer (FR-43)
--   change      value minus the baseline value, null if hidden
--   pct_change  % change against the baseline, null if the baseline is 0
--   entry_count how many entries the point stands for (1 unless grouped)
--   entry_id, comment  only for single entries
-- baseline: 'first' (the subject's first entry ever for the attribute) or
-- 'group_start' (the first entry on or after the group's start date, FR-64;
-- like 'first' for groups without a duration). Either way the baseline doesn't
-- depend on the range, so narrowing the range doesn't change the numbers.
-- max_points: when the busiest line in the range has more entries than this,
-- entries are grouped by day, week or month, whichever is the finest that
-- keeps every line within the limit, and each point is their average.
create function public.get_series(
  target_group_id uuid,
  from_at timestamptz default null,
  to_at timestamptz default null,
  max_points integer default null,
  baseline text default 'first'
)
returns table (
  subject_id uuid,
  attribute_id uuid,
  measured_at timestamptz,
  value numeric,
  change numeric,
  pct_change numeric,
  entry_count integer,
  entry_id uuid,
  comment text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  group_start timestamptz;
  busiest integer;
  span_days numeric;
  bucket text := 'entry';
begin
  if not public.is_member(target_group_id) then
    raise exception using errcode = '42501', message = 'not_a_member';
  end if;
  if baseline not in ('first', 'group_start') then
    raise exception using errcode = '22023', message = 'invalid_baseline';
  end if;

  if baseline = 'group_start' then
    select g.starts_on::timestamptz into group_start
    from public.groups g where g.id = target_group_id;
  end if;

  if max_points is not null then
    select max(c.n), extract(epoch from max(c.last_at) - min(c.first_at)) / 86400
    into busiest, span_days
    from (
      select count(*) as n, min(e.measured_at) as first_at, max(e.measured_at) as last_at
      from public.entries e
      join public.subjects s on s.id = e.subject_id
      where s.group_id = target_group_id
        and (from_at is null or e.measured_at >= from_at)
        and (to_at is null or e.measured_at <= to_at)
      group by e.subject_id, e.attribute_id
    ) c;

    if busiest > max_points then
      bucket := case
        when span_days + 1 <= max_points then 'day'
        when (span_days + 7) / 7 <= max_points then 'week'
        else 'month'
      end;
    end if;
  end if;

  return query
  with bases as (
    select distinct on (e.subject_id, e.attribute_id)
      e.subject_id, e.attribute_id, e.value as base
    from public.entries e
    join public.subjects s on s.id = e.subject_id
    where s.group_id = target_group_id
      and (group_start is null or e.measured_at >= group_start)
    order by e.subject_id, e.attribute_id, e.measured_at
  ),
  in_range as (
    select
      e.id, e.subject_id, e.attribute_id, e.measured_at, e.value, e.comment, b.base,
      case
        when bucket = 'entry' then e.id::text
        else date_trunc(bucket, e.measured_at)::text
      end as slot
    from public.entries e
    join public.subjects s on s.id = e.subject_id
    left join bases b on b.subject_id = e.subject_id and b.attribute_id = e.attribute_id
    where s.group_id = target_group_id
      and (from_at is null or e.measured_at >= from_at)
      and (to_at is null or e.measured_at <= to_at)
  ),
  points as (
    select
      r.subject_id, r.attribute_id,
      to_timestamp(avg(extract(epoch from r.measured_at))) as at,
      avg(r.value) as average,
      max(r.base) as base,
      count(*)::integer as n,
      (array_agg(r.id))[1] as single_id,
      (array_agg(r.comment))[1] as single_comment
    from in_range r
    group by r.subject_id, r.attribute_id, r.slot
  )
  select
    p.subject_id,
    p.attribute_id,
    p.at,
    case when v.visible then p.average end,
    case when v.visible then p.average - p.base end,
    case when p.base <> 0 then round((p.average - p.base) / abs(p.base) * 100, 2) end,
    p.n,
    case when p.n = 1 then p.single_id end,
    case when p.n = 1 then p.single_comment end
  from points p
  cross join lateral (
    select public.can_see_values(p.subject_id, p.attribute_id) as visible
  ) v
  order by p.at, p.subject_id, p.attribute_id;
end;
$$;

revoke execute on function public.get_series(uuid, timestamptz, timestamptz, integer, text) from public, anon;
grant execute on function public.get_series(uuid, timestamptz, timestamptz, integer, text) to authenticated;
