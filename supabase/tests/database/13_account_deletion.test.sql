-- Step 15: deleting an account (FR-3). The delete-account Edge Function
-- deletes the auth user; here that's done directly.
begin;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local', '{"display_name": "Sam"}');

-- Alex owns "Kids"; Sam edits it, tracks himself there and logs for Mia.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Kids');
reset role;
insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor');
insert into public.subjects (id, group_id, name, linked_user_id) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Mia', null),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Sam', '22222222-2222-2222-2222-222222222222');
insert into public.attributes (id, group_id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Height');
-- Logged by Sam: the entries trigger records the signed-in user.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
insert into public.entries (id, subject_id, attribute_id, value, measured_at, created_by) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 110, '2026-10-01 08:00+00', '22222222-2222-2222-2222-222222222222'),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 180, '2026-10-01 08:00+00', '22222222-2222-2222-2222-222222222222');
select set_config('request.jwt.claims', '', true);
insert into public.value_visibility (subject_id, attribute_id, visibility) values
  ('e0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'relative');

-- Sam's personal logbook is shared with Alex.
insert into public.memberships (group_id, user_id, role)
select id, '11111111-1111-1111-1111-111111111111', 'viewer'
from public.groups where default_for_user_id = '22222222-2222-2222-2222-222222222222';

-- An owner of another group can't be deleted.
select throws_ok(
  $$ delete from auth.users where id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001', 'owns_groups', 'owners of other groups are not deleted'
);

-- Sam can.
select lives_ok(
  $$ delete from auth.users where id = '22222222-2222-2222-2222-222222222222' $$,
  'a user without other groups is deleted'
);
select is_empty(
  $$ select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222' $$,
  'the profile is gone'
);
select is_empty(
  $$ select 1 from public.groups where default_for_user_id = '22222222-2222-2222-2222-222222222222' $$,
  'the default group is gone, also for those it was shared with'
);
select is_empty(
  $$ select 1 from public.memberships where user_id = '22222222-2222-2222-2222-222222222222' $$,
  'the memberships are gone'
);
select is_empty(
  $$ select 1 from public.subjects where id = 'e0000000-0000-0000-0000-000000000002' $$,
  'the linked subject is gone'
);
select is_empty(
  $$ select 1 from public.entries where id = 'c0000000-0000-0000-0000-000000000002' $$,
  'with its entries'
);
select is_empty(
  $$ select 1 from public.value_visibility where subject_id = 'e0000000-0000-0000-0000-000000000002' $$,
  'and its settings'
);
select is(
  (select value from public.entries where id = 'c0000000-0000-0000-0000-000000000001'),
  110::numeric, 'entries logged for others stay'
);
select is(
  (select created_by from public.entries where id = 'c0000000-0000-0000-0000-000000000001'),
  null, 'without the name of who logged them'
);

-- After transferring or deleting their groups, owners can go too.
delete from public.groups where id = 'd0000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ delete from auth.users where id = '11111111-1111-1111-1111-111111111111' $$,
  'an owner without other groups is deleted'
);

select * from finish();
rollback;
