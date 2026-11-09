-- Step 6: entries, who may log them, their checks, and the rules that depend
-- on them (attribute deletion, profiles of co-members).
begin;
select plan(36);

-- Alex owns "Kids", Sam edits it, Kim views it (and tracks herself in it),
-- Lee isn't in it.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local', '{"display_name": "Sam"}'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local', '{"display_name": "Kim"}'),
  ('44444444-4444-4444-4444-444444444444', 'lee@test.local', '{"display_name": "Lee"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Kids');
reset role;

insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');
insert into public.subjects (id, group_id, name, linked_user_id, archived_at) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Mia', null, null),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Kim', '33333333-3333-3333-3333-333333333333', null),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Old', null, now());
insert into public.attributes (id, group_id, name, min_value, max_value, archived_at) values
  ('a1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Weight', 2, 150, null),
  ('a1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Height', null, null, null),
  ('a1000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Old metric', null, null, now());
-- An attribute in Alex's Personal group, to test mixing groups.
insert into public.attributes (id, group_id, name)
select 'a1000000-0000-0000-0000-000000000009', id, 'Steps'
from public.groups where default_for_user_id = '11111111-1111-1111-1111-111111111111';

-- Logging (FR-50, FR-51)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.entries (id, subject_id, attribute_id, value, measured_at, comment) values
       ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
        'a1000000-0000-0000-0000-000000000001', 18.4, '2026-10-04 09:00+02', 'After breakfast'),
       ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001',
        'a1000000-0000-0000-0000-000000000002', 104.5, '2026-10-04 09:00+02', 'After breakfast') $$,
  'owners log several attributes for a subject at once'
);
select results_eq(
  $$ select created_by, updated_by is null, updated_at is null from public.entries
     where id = 'f0000000-0000-0000-0000-000000000001' $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, true, true) $$,
  'the database records who logged an entry'
);
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at, created_by)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 18, now(),
             '22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'the app cannot say who logged an entry'
);

-- Checks (FR-40, FR-53, FR-54, FR-80)
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 18, '2026-10-04 09:00+02') $$,
  '23505', null, 'two entries for the same subject and attribute at the same moment are refused'
);
select lives_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 18.6, '2026-10-04 19:00+02') $$,
  'several entries on the same day are fine'
);
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 18, now() + interval '1 hour') $$,
  'P0001', 'measured_at_in_future', 'future times are refused'
);
select lives_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', 105, now() + interval '2 minutes') $$,
  'a few minutes of clock skew are allowed'
);
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 180, '2026-10-05 09:00+02') $$,
  'P0001', 'value_out_of_range', 'values outside the attribute''s limits are refused'
);
select lives_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000002', -3, '2026-10-05 09:00+02') $$,
  'any number is allowed without limits, negative ones included'
);
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000009', 5000, '2026-10-05 09:00+02') $$,
  'P0001', 'entry_group_mismatch', 'the subject and the attribute must be in the same group'
);
select throws_ok(
  $$ update public.entries set comment = repeat('x', 501) where id = 'f0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'comments longer than 500 characters are refused'
);
select throws_ok(
  $$ update public.entries set comment = '  ' where id = 'f0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a comment of only spaces is refused (no comment is null)'
);
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 18, '2026-10-05 09:00+02') $$,
  '42501', null, 'nothing can be logged for an archived subject'
);
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000003', 18, '2026-10-05 09:00+02') $$,
  '42501', null, 'nothing can be logged for an archived attribute'
);

-- Limits only apply to new or changed values (FR-40).
reset role;
update public.attributes set min_value = 50 where id = 'a1000000-0000-0000-0000-000000000001';
set local role authenticated;
select lives_ok(
  $$ update public.entries set comment = 'Weighed on the old scale' where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'an entry outside a newer limit can still have its comment edited'
);
select throws_ok(
  $$ update public.entries set value = 18.5 where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'value_out_of_range', '...but a changed value must be within the limits'
);
reset role;
update public.attributes set min_value = 2 where id = 'a1000000-0000-0000-0000-000000000001';

-- Editors (§5)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ update public.entries set value = 18.5 where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'editors can edit entries for any subject'
);
select results_eq(
  $$ select created_by, updated_by, updated_at is not null from public.entries
     where id = 'f0000000-0000-0000-0000-000000000001' $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, true) $$,
  'the database records who changed an entry, and keeps who logged it'
);
select lives_ok(
  $$ insert into public.entries (id, subject_id, attribute_id, value, measured_at)
     values ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002',
             'a1000000-0000-0000-0000-000000000001', 61, '2026-10-06 08:00+02') $$,
  'editors can log for a member''s linked subject'
);
insert into public.entries (id, subject_id, attribute_id, value, measured_at)
values ('f0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000001',
        'a1000000-0000-0000-0000-000000000002', 106, '2026-10-06 08:00+02');

-- Viewers (§5)
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.entries),
  7,
  'viewers see the group''s entries'
);
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 18, '2026-10-07 09:00+02') $$,
  '42501', null, 'viewers cannot log for other subjects'
);
select lives_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 60.5, '2026-10-07 08:00+02') $$,
  'viewers can log for their own linked subject'
);
select lives_ok(
  $$ update public.entries set value = 60.8 where id = 'f0000000-0000-0000-0000-000000000003' $$,
  '...and edit its entries'
);
update public.entries set value = 1 where id = 'f0000000-0000-0000-0000-000000000002';
delete from public.entries where id = 'f0000000-0000-0000-0000-000000000002';
select is(
  (select value from public.entries where id = 'f0000000-0000-0000-0000-000000000002'),
  104.5,
  'viewers cannot edit or delete other subjects'' entries'
);

-- Non-members
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select is_empty('select 1 from public.entries', 'non-members see no entries');
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 18, '2026-10-07 09:00+02') $$,
  '42501', null, 'non-members cannot log'
);

-- "Members can only edit their own subject" (§5) applies to everyone.
reset role;
update public.groups set members_edit_own_subject_only = true where id = 'd0000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 18, '2026-10-08 09:00+02') $$,
  '42501', null, 'with "own subject only", even the owner cannot log for other subjects'
);
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 60.2, '2026-10-08 08:00+02') $$,
  '...while members still log for their own'
);
reset role;
update public.groups set members_edit_own_subject_only = false where id = 'd0000000-0000-0000-0000-000000000001';

-- Deleting (FR-52)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ delete from public.entries where id = 'f0000000-0000-0000-0000-000000000002' $$,
  'editors can delete entries'
);

-- Deleting attributes that have entries (FR-42)
delete from public.attributes where id = 'a1000000-0000-0000-0000-000000000001';
select isnt_empty(
  $$ select 1 from public.attributes where id = 'a1000000-0000-0000-0000-000000000001' $$,
  'editors cannot delete an attribute that has entries'
);
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ delete from public.attributes where id = 'a1000000-0000-0000-0000-000000000001' $$,
  'owners can delete an attribute that has entries'
);
select is_empty(
  $$ select 1 from public.entries where attribute_id = 'a1000000-0000-0000-0000-000000000001' $$,
  '...and its entries go with it'
);

-- Profiles of co-members (FR-50: who logged an entry)
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select results_eq(
  'select display_name from public.profiles order by display_name',
  $$ values ('Alex'), ('Kim'), ('Sam') $$,
  'members can read the display names of people they share a group with'
);
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select results_eq(
  'select display_name from public.profiles',
  $$ values ('Lee') $$,
  '...and nobody else''s'
);
update public.profiles set display_name = 'Hacked' where id = '11111111-1111-1111-1111-111111111111';
reset role;
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alex',
  'other people''s profiles stay read-only'
);

-- Account deletion keeps entries logged for others, without the person (FR-3).
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select count(*)::int from public.entries
   where id = 'f0000000-0000-0000-0000-000000000004' and created_by is null),
  1,
  'entries logged by a deleted account stay, without who logged them'
);

select * from finish();
rollback;
