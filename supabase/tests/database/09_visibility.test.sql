-- Step 11: value visibility (FR-43). This is where a mistake leaks someone's
-- data, so every role and path is tested: owners, editors, viewers,
-- subjects without an account, former members' frozen subjects, and every
-- way values are read (the entries table, get_series, get_dashboard,
-- get_entry_rows).
begin;
select plan(41);

-- Alex owns "Diet"; Sam edits; Kim and Lee view and track themselves; Mia has
-- no account; Zoe isn't a member.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local', '{"display_name": "Sam"}'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local', '{"display_name": "Kim"}'),
  ('44444444-4444-4444-4444-444444444444', 'lee@test.local', '{"display_name": "Lee"}'),
  ('66666666-6666-6666-6666-666666666666', 'zoe@test.local', '{"display_name": "Zoe"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Diet');
reset role;

insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer'),
  ('d0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer');
insert into public.subjects (id, group_id, name, linked_user_id) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Mia', null),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Kim', '33333333-3333-3333-3333-333333333333'),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'Lee', '44444444-4444-4444-4444-444444444444');
insert into public.attributes (id, group_id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Weight'),
  ('a1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Waist');
-- An attribute in Alex's Personal group, for the same-group check.
insert into public.attributes (id, group_id, name)
select 'a1000000-0000-0000-0000-000000000009', id, 'Steps'
from public.groups where default_for_user_id = '11111111-1111-1111-1111-111111111111';
insert into public.entries (id, subject_id, attribute_id, value, measured_at, comment) values
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 70, '2026-10-01 08:00+00', null),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 68, '2026-10-08 08:00+00', 'Feeling good'),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 80, '2026-10-01 08:00+00', null),
  ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 20, '2026-10-01 08:00+00', null),
  ('f0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 90, '2026-10-01 08:00+00', null),
  ('f0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 88, '2026-10-08 08:00+00', null);

-- Helpers: act as a user.
create function pg_temp.as_user(user_id uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- By default everyone sees actual values.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.entries where subject_id = 'e0000000-0000-0000-0000-000000000003'),
  3,
  'by default members see each other''s values'
);

-- Kim hides her weight.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select lives_ok(
  $$ insert into public.value_visibility (subject_id, attribute_id, visibility)
     values ('e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'relative') $$,
  'a member can set their own subject''s attribute to "% only"'
);
select throws_ok(
  $$ insert into public.value_visibility (subject_id, attribute_id, visibility)
     values ('e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000009', 'relative') $$,
  'P0001', 'visibility_group_mismatch', 'the attribute must be in the subject''s group'
);
select is(
  (select count(*)::int from public.entries where subject_id = 'e0000000-0000-0000-0000-000000000003'),
  3,
  'the member still sees all their own values'
);
select lives_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 67, '2026-10-15 08:00+00') $$,
  '...and logs them'
);

-- The owner: no exceptions.
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.entries
   where subject_id = 'e0000000-0000-0000-0000-000000000003' and attribute_id = 'a1000000-0000-0000-0000-000000000001'),
  0,
  'the owner cannot read hidden values from the entries table'
);
select is(
  (select count(*)::int from public.entries
   where subject_id = 'e0000000-0000-0000-0000-000000000003' and attribute_id = 'a1000000-0000-0000-0000-000000000002'),
  1,
  '...but still sees the attributes that aren''t hidden'
);
select results_eq(
  $$ select value, change, pct_change from public.get_series('d0000000-0000-0000-0000-000000000001')
     where subject_id = 'e0000000-0000-0000-0000-000000000003' and attribute_id = 'a1000000-0000-0000-0000-000000000001' $$,
  $$ values (null::numeric, null::numeric, 0::numeric), (null, null, -2.86), (null, null, -4.29) $$,
  'the series gives the owner only % changes for hidden values'
);
select is(
  (select comment from public.get_series('d0000000-0000-0000-0000-000000000001')
   where entry_id = 'f0000000-0000-0000-0000-000000000002'),
  'Feeling good',
  'comments stay visible'
);
select results_eq(
  $$ select first_value, previous_value, latest_value, change_since_previous, change_since_first, pct_since_first
     from public.get_dashboard('d0000000-0000-0000-0000-000000000001')
     where subject_id = 'e0000000-0000-0000-0000-000000000003' and attribute_id = 'a1000000-0000-0000-0000-000000000001' $$,
  $$ values (null::numeric, null::numeric, null::numeric, null::numeric, null::numeric, -4.29::numeric) $$,
  'the dashboard gives the owner only % changes for hidden values'
);
select results_eq(
  $$ select value, pct_change, comment from public.get_entry_rows('d0000000-0000-0000-0000-000000000001',
       'e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'oldest') $$,
  $$ values (null::numeric, 0::numeric, null::text), (null, -2.86, 'Feeling good'), (null, -4.29, null) $$,
  'the entry list shows hidden entries with their % change and comment'
);
select results_eq(
  $$ select subject_id, value from public.get_entry_rows('d0000000-0000-0000-0000-000000000001',
       null, 'a1000000-0000-0000-0000-000000000001', 'highest') $$,
  $$ values ('e0000000-0000-0000-0000-000000000004'::uuid, 90::numeric),
            ('e0000000-0000-0000-0000-000000000004'::uuid, 88),
            ('e0000000-0000-0000-0000-000000000001'::uuid, 20),
            ('e0000000-0000-0000-0000-000000000003'::uuid, null),
            ('e0000000-0000-0000-0000-000000000003'::uuid, null),
            ('e0000000-0000-0000-0000-000000000003'::uuid, null) $$,
  'sorting by value puts hidden entries last, so the order reveals nothing'
);
select is(
  (select total_count from public.get_entry_rows('d0000000-0000-0000-0000-000000000001') limit 1),
  7::bigint,
  'the entry list counts every entry'
);
select is(
  public.attribute_entry_count('a1000000-0000-0000-0000-000000000001'),
  6,
  'entry counts include hidden entries'
);
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 50, '2026-10-20 08:00+00') $$,
  '42501', null, 'the owner cannot log hidden values for someone else'
);
update public.entries set value = 1 where id = 'f0000000-0000-0000-0000-000000000002';
select throws_ok(
  $$ insert into public.value_visibility (subject_id, attribute_id, visibility)
     values ('e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000002', 'relative') $$,
  '42501', null, 'the owner cannot change a member''s setting'
);
update public.value_visibility set visibility = 'absolute'
where subject_id = 'e0000000-0000-0000-0000-000000000003';
delete from public.value_visibility where subject_id = 'e0000000-0000-0000-0000-000000000003';
select is(
  (select visibility::text from public.value_visibility
   where subject_id = 'e0000000-0000-0000-0000-000000000003' and attribute_id = 'a1000000-0000-0000-0000-000000000001'),
  'relative',
  'the owner can see the setting, but not change or remove it'
);

-- An editor and a fellow viewer: the same.
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.entries
   where subject_id = 'e0000000-0000-0000-0000-000000000003' and attribute_id = 'a1000000-0000-0000-0000-000000000001'),
  0,
  'editors cannot read hidden values'
);
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select is(
  (select count(*)::int from public.get_series('d0000000-0000-0000-0000-000000000001')
   where subject_id = 'e0000000-0000-0000-0000-000000000003' and attribute_id = 'a1000000-0000-0000-0000-000000000001'
     and value is not null),
  0,
  'other viewers cannot read hidden values'
);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(
  (select value from public.entries where id = 'f0000000-0000-0000-0000-000000000002'),
  null,
  '(the owner''s edit of the hidden entry changed nothing it could see)'
);
reset role;
select is(
  (select value from public.entries where id = 'f0000000-0000-0000-0000-000000000002'),
  68::numeric,
  'the owner could not change the hidden entry'
);
set local role authenticated;

-- Non-members see nothing, not even the settings.
select pg_temp.as_user('66666666-6666-6666-6666-666666666666');
select is_empty('select 1 from public.value_visibility', 'non-members see no settings');
select throws_ok(
  $$ select * from public.get_entry_rows('d0000000-0000-0000-0000-000000000001') $$,
  '42501', 'not_a_member', 'non-members cannot list entries'
);
select is(
  public.attribute_entry_count('a1000000-0000-0000-0000-000000000001'),
  null,
  'non-members get no entry counts'
);

-- A subject without an account: decided by those who may log for it.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select throws_ok(
  $$ insert into public.value_visibility (subject_id, attribute_id, visibility)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'relative') $$,
  '42501', null, 'viewers cannot set it for a subject without an account'
);
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select lives_ok(
  $$ insert into public.value_visibility (subject_id, attribute_id, visibility)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'relative') $$,
  'editors can set it for a subject without an account'
);
select is(
  (select count(*)::int from public.entries where subject_id = 'e0000000-0000-0000-0000-000000000001'),
  1,
  'those who may log for it still see its values'
);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.entries where subject_id = 'e0000000-0000-0000-0000-000000000001'),
  1,
  '...the owner included'
);
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.entries where subject_id = 'e0000000-0000-0000-0000-000000000001'),
  0,
  'viewers do not'
);

-- "Members can only edit their own subject": then even the owner may not
-- log for the child, so the owner doesn't see its hidden values either.
reset role;
update public.groups set members_edit_own_subject_only = true where id = 'd0000000-0000-0000-0000-000000000001';
set local role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.entries where subject_id = 'e0000000-0000-0000-0000-000000000001'),
  0,
  'with "own subject only", the owner no longer sees a hidden child''s values'
);
select results_eq(
  $$ with changed as (
       update public.value_visibility set visibility = 'absolute'
       where subject_id = 'e0000000-0000-0000-0000-000000000001'
       returning 1)
     select count(*)::int from changed $$,
  $$ values (0) $$,
  '...and cannot change its setting'
);
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*)::int from public.entries where subject_id = 'e0000000-0000-0000-0000-000000000003'),
  4,
  'members still see their own'
);
reset role;
update public.groups set members_edit_own_subject_only = false where id = 'd0000000-0000-0000-0000-000000000001';
set local role authenticated;

-- A former member's subject (FR-23): frozen, visible to nobody if hidden,
-- unchangeable and read-only.
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
insert into public.value_visibility (subject_id, attribute_id, visibility)
values ('e0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'relative');
select public.leave_group('d0000000-0000-0000-0000-000000000001', true);

select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.entries where subject_id = 'e0000000-0000-0000-0000-000000000004'),
  0,
  'hidden values of a former member stay hidden from the owner'
);
select results_eq(
  $$ select value, pct_change from public.get_series('d0000000-0000-0000-0000-000000000001')
     where subject_id = 'e0000000-0000-0000-0000-000000000004' $$,
  $$ values (null::numeric, 0::numeric), (null, -2.22) $$,
  '...who sees only their % change'
);
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select is(
  (select count(*)::int from public.entries where subject_id = 'e0000000-0000-0000-0000-000000000004'),
  0,
  '...and so does everyone else'
);
select results_eq(
  $$ with changed as (
       update public.value_visibility set visibility = 'absolute'
       where subject_id = 'e0000000-0000-0000-0000-000000000004'
       returning 1)
     select count(*)::int from changed $$,
  $$ values (0) $$,
  'nobody can change a former member''s setting'
);
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000002', 85, '2026-10-20 08:00+00') $$,
  '42501', null, 'nobody can log for a former member''s subject'
);
select is(
  public.can_set_visibility('e0000000-0000-0000-0000-000000000004'),
  false,
  'a frozen subject''s visibility cannot be set by anyone'
);

-- Back to actual values: everyone sees them again.
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select lives_ok(
  $$ delete from public.value_visibility
     where subject_id = 'e0000000-0000-0000-0000-000000000003' and attribute_id = 'a1000000-0000-0000-0000-000000000001' $$,
  'members can go back to actual values'
);
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select is(
  (select count(*)::int from public.entries
   where subject_id = 'e0000000-0000-0000-0000-000000000003' and attribute_id = 'a1000000-0000-0000-0000-000000000001'),
  3,
  '...and all past entries show again'
);
select is(
  (select count(*)::int from public.get_series('d0000000-0000-0000-0000-000000000001')
   where subject_id = 'e0000000-0000-0000-0000-000000000003' and value is not null),
  4,
  '...in the series too'
);

select * from finish();
rollback;
