-- Step 7: get_series and get_dashboard, the reads behind the group page.
begin;
select plan(13);

-- Alex owns "Kids", Kim views it, Lee isn't in it.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'lee@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Kids');
reset role;

insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');
insert into public.subjects (id, group_id, name) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Mia'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Noah'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Leo');
insert into public.attributes (id, group_id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Weight'),
  ('a1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Goals');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.entries (subject_id, attribute_id, value, measured_at) values
  ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 20, '2026-09-01 08:00+00'),
  ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 21, '2026-10-01 08:00+00'),
  ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 19, '2026-11-01 08:00+00'),
  ('e0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 14, '2026-10-15 08:00+00'),
  ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 0, '2026-09-01 08:00+00'),
  ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 3, '2026-10-01 08:00+00');
-- Leo is weighed often, for grouping.
insert into public.entries (subject_id, attribute_id, value, measured_at, comment) values
  ('e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 10, '2026-10-01 08:00+00', null),
  ('e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 11, '2026-10-02 08:00+00', null),
  ('e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 12, '2026-10-03 08:00+00', null),
  ('e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 13, '2026-11-01 08:00+00', 'New scale');

-- get_series
select results_eq(
  $$ select value, change, pct_change, entry_count from public.get_series('d0000000-0000-0000-0000-000000000001')
     where subject_id = 'e0000000-0000-0000-0000-000000000001'
       and attribute_id = 'a1000000-0000-0000-0000-000000000001' $$,
  $$ values (20::numeric, 0::numeric, 0::numeric, 1), (21, 1, 5, 1), (19, -1, -5, 1) $$,
  'the series has every value, oldest first, with the change and % change since the first entry'
);
select results_eq(
  $$ select value, pct_change from public.get_series('d0000000-0000-0000-0000-000000000001', '2026-09-15', null)
     where subject_id = 'e0000000-0000-0000-0000-000000000001'
       and attribute_id = 'a1000000-0000-0000-0000-000000000001' $$,
  $$ values (21::numeric, 5::numeric), (19, -5) $$,
  'a range keeps the first entry ever as the baseline'
);
select results_eq(
  $$ select value, pct_change from public.get_series('d0000000-0000-0000-0000-000000000001')
     where attribute_id = 'a1000000-0000-0000-0000-000000000002' $$,
  $$ values (0::numeric, null::numeric), (3, null) $$,
  'a baseline of 0 gives no % change'
);

-- get_dashboard
select results_eq(
  $$ select entry_count, first_value, previous_value, latest_value,
            change_since_previous, change_since_first, pct_since_previous, pct_since_first
     from public.get_dashboard('d0000000-0000-0000-0000-000000000001')
     where subject_id = 'e0000000-0000-0000-0000-000000000001'
       and attribute_id = 'a1000000-0000-0000-0000-000000000001' $$,
  $$ values (3, 20::numeric, 21::numeric, 19::numeric, -2::numeric, -1::numeric, -9.52::numeric, -5::numeric) $$,
  'the dashboard has the first, previous and latest value and the changes'
);
select results_eq(
  $$ select entry_count, previous_value, latest_value, change_since_previous, change_since_first
     from public.get_dashboard('d0000000-0000-0000-0000-000000000001')
     where subject_id = 'e0000000-0000-0000-0000-000000000002' $$,
  $$ values (1, null::numeric, 14::numeric, null::numeric, 0::numeric) $$,
  'with a single entry there is no previous value'
);
select is(
  (select count(*)::int from public.get_dashboard('d0000000-0000-0000-0000-000000000001')),
  4,
  'one row per subject and attribute with entries'
);

-- Grouping (step 8)
select results_eq(
  $$ select value, entry_count, entry_id is null, comment
     from public.get_series('d0000000-0000-0000-0000-000000000001', null, null, 2)
     where subject_id = 'e0000000-0000-0000-0000-000000000003' $$,
  $$ values (11::numeric, 3, true, null::text), (13, 1, false, 'New scale') $$,
  'over the limit, entries are averaged per month; single entries keep their id and comment'
);
select is(
  (select count(*)::int from public.get_series('d0000000-0000-0000-0000-000000000001', null, null, 4)),
  10,
  'within the limit, every entry is its own point'
);

-- Baselines (FR-64)
reset role;
update public.groups set starts_on = '2026-10-01', ends_on = '2026-12-31'
where id = 'd0000000-0000-0000-0000-000000000001';
set local role authenticated;
select results_eq(
  $$ select change, pct_change from public.get_series('d0000000-0000-0000-0000-000000000001', null, null, null, 'group_start')
     where subject_id = 'e0000000-0000-0000-0000-000000000001'
       and attribute_id = 'a1000000-0000-0000-0000-000000000001' $$,
  $$ values (-1::numeric, -4.76::numeric), (0, 0), (-2, -9.52) $$,
  '"since the group''s start" measures from the first entry on or after the start date'
);
select throws_ok(
  $$ select * from public.get_series('d0000000-0000-0000-0000-000000000001', null, null, null, 'whenever') $$,
  '22023', 'invalid_baseline', 'only the two baselines are allowed'
);

-- Who may read
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.get_series('d0000000-0000-0000-0000-000000000001')),
  10,
  'viewers read the series'
);
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select throws_ok(
  $$ select * from public.get_series('d0000000-0000-0000-0000-000000000001') $$,
  '42501', 'not_a_member', 'non-members cannot read the series'
);
select throws_ok(
  $$ select * from public.get_dashboard('d0000000-0000-0000-0000-000000000001') $$,
  '42501', 'not_a_member', 'non-members cannot read the dashboard'
);

select * from finish();
rollback;
