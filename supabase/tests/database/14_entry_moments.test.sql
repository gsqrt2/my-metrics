-- Backlog: editing everything logged for a subject at one moment at once
-- (save_entry_moment).
begin;
select plan(13);

-- Alex owns "Kids", Kim views it and tracks herself in it.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local', '{"display_name": "Kim"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Kids');
reset role;

insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');
insert into public.subjects (id, group_id, name, linked_user_id) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Mia', null),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Kim', '33333333-3333-3333-3333-333333333333');
insert into public.attributes (id, group_id, name, min_value, max_value, archived_at) values
  ('a1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Weight', 2, 150, null),
  ('a1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Height', null, null, null),
  ('a1000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Waist', null, null, null),
  ('a1000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'Shoe size', null, null, null);

-- Mia at 09:00: weight, height, shoe size (logged together, one comment).
-- Another moment at 19:00 with a weight.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.entries (subject_id, attribute_id, value, measured_at, comment) values
  ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 18.4, '2026-10-04 09:00+02', 'After breakfast'),
  ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 104.5, '2026-10-04 09:00+02', 'After breakfast'),
  ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000004', 28, '2026-10-04 09:00+02', 'After breakfast'),
  ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 18.6, '2026-10-04 19:00+02', null);
reset role;
-- Shoe size gets archived: it's left out of edits from now on.
update public.attributes set archived_at = now() where id = 'a1000000-0000-0000-0000-000000000004';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

-- One edit: weight changed, height cleared, waist added, new time and comment.
select lives_ok(
  $$ select public.save_entry_moment(
       'e0000000-0000-0000-0000-000000000001', '2026-10-04 09:00+02', '2026-10-04 08:30+02', '  Before breakfast ',
       '{"a1000000-0000-0000-0000-000000000001": 18.2,
         "a1000000-0000-0000-0000-000000000002": null,
         "a1000000-0000-0000-0000-000000000003": 52}'::jsonb) $$,
  'a moment is saved in one call'
);
select results_eq(
  $$ select a.name, e.value, e.comment from public.entries e
     join public.attributes a on a.id = e.attribute_id
     where e.subject_id = 'e0000000-0000-0000-0000-000000000001' and e.measured_at = '2026-10-04 08:30+02'
     order by a.name $$,
  $$ values ('Waist'::text, 52::numeric, 'Before breakfast'::text),
            ('Weight', 18.2, 'Before breakfast') $$,
  'values change, a cleared one is deleted, an empty one is added; time and trimmed comment apply to all'
);
select results_eq(
  $$ select updated_by from public.entries
     where subject_id = 'e0000000-0000-0000-0000-000000000001'
       and attribute_id = 'a1000000-0000-0000-0000-000000000001' and measured_at = '2026-10-04 08:30+02' $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'changed entries record who changed them'
);
select results_eq(
  $$ select value, measured_at = '2026-10-04 09:00+02' from public.entries
     where attribute_id = 'a1000000-0000-0000-0000-000000000004' $$,
  $$ values (28::numeric, true) $$,
  'a metric left out (archived) keeps its entry as it was'
);
select results_eq(
  $$ select value from public.entries
     where subject_id = 'e0000000-0000-0000-0000-000000000001' and measured_at = '2026-10-04 19:00+02' $$,
  $$ values (18.6::numeric) $$,
  'other moments are untouched'
);

-- An empty comment is stored as no comment.
select lives_ok(
  $$ select public.save_entry_moment(
       'e0000000-0000-0000-0000-000000000001', '2026-10-04 08:30+02', '2026-10-04 08:30+02', '   ',
       '{"a1000000-0000-0000-0000-000000000001": 18.2, "a1000000-0000-0000-0000-000000000003": 52}'::jsonb) $$,
  'saving with an empty comment works'
);
select is(
  (select count(*)::int from public.entries
   where subject_id = 'e0000000-0000-0000-0000-000000000001' and measured_at = '2026-10-04 08:30+02'
     and comment is null),
  2,
  'an empty comment clears the comment'
);

-- All or nothing: one value out of range keeps every change from happening.
select throws_ok(
  $$ select public.save_entry_moment(
       'e0000000-0000-0000-0000-000000000001', '2026-10-04 08:30+02', '2026-10-04 08:30+02', null,
       '{"a1000000-0000-0000-0000-000000000003": 60, "a1000000-0000-0000-0000-000000000001": 500}'::jsonb) $$,
  'P0001', 'value_out_of_range', 'a value outside the limits is refused'
);
select is(
  (select value from public.entries
   where attribute_id = 'a1000000-0000-0000-0000-000000000003' and measured_at = '2026-10-04 08:30+02'),
  52::numeric,
  'nothing of a refused save is kept'
);

-- Moving onto another moment that has the same metric is refused.
select throws_ok(
  $$ select public.save_entry_moment(
       'e0000000-0000-0000-0000-000000000001', '2026-10-04 08:30+02', '2026-10-04 19:00+02', null,
       '{"a1000000-0000-0000-0000-000000000001": 18.2}'::jsonb) $$,
  '23505', null, 'a time that clashes with another entry of the metric is refused'
);
select throws_ok(
  $$ select public.save_entry_moment(
       'e0000000-0000-0000-0000-000000000001', '2026-10-04 08:30+02', '2026-10-04 08:30+02', null,
       '[18.2]'::jsonb) $$,
  'P0001', 'invalid_input', 'values must be given per metric'
);

-- Kim, a viewer, may log for herself but not for Mia.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.save_entry_moment(
       'e0000000-0000-0000-0000-000000000001', '2026-10-04 08:30+02', '2026-10-04 08:30+02', null,
       '{"a1000000-0000-0000-0000-000000000001": 18}'::jsonb) $$,
  'P0001', 'not_allowed', 'viewers cannot change values of others'
);
select lives_ok(
  $$ select public.save_entry_moment(
       'e0000000-0000-0000-0000-000000000002', '2026-10-05 07:00+02', '2026-10-05 07:00+02', null,
       '{"a1000000-0000-0000-0000-000000000001": 61.5}'::jsonb) $$,
  'linked users add values to their own moments'
);

reset role;
select * from finish();
rollback;
