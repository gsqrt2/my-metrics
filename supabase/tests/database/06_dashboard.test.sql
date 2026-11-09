-- Step 7: get_series and get_dashboard, the reads behind the group page.
begin;
select plan(9);

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
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Noah');
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

-- get_series
select results_eq(
  $$ select value, pct_change from public.get_series('d0000000-0000-0000-0000-000000000001')
     where subject_id = 'e0000000-0000-0000-0000-000000000001'
       and attribute_id = 'a1000000-0000-0000-0000-000000000001' $$,
  $$ values (20::numeric, 0::numeric), (21, 5), (19, -5) $$,
  'the series has every value, oldest first, with the % change since the first entry'
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
  3,
  'one row per subject and attribute with entries'
);

-- Who may read
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.get_series('d0000000-0000-0000-0000-000000000001')),
  6,
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
