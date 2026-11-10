-- Step 12: only the owner changes "Members can only edit their own subject".
-- (What the setting does to logging is tested with entries and visibility.)
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local', '{"display_name": "Sam"}'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local', '{"display_name": "Kim"}'),
  ('66666666-6666-6666-6666-666666666666', 'zoe@test.local', '{"display_name": "Zoe"}');

-- A new group may start with the setting on.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.groups (id, name, members_edit_own_subject_only)
     values ('d0000000-0000-0000-0000-000000000001', 'Diet', true) $$,
  'a new group can start with own subject only'
);
reset role;
select is(
  (select members_edit_own_subject_only from public.groups where id = 'd0000000-0000-0000-0000-000000000001'),
  true, 'and it is saved'
);

insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');

-- Editors edit the group, but not this setting.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ update public.groups set members_edit_own_subject_only = false where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the setting is not a column the app may update'
);
select throws_ok(
  $$ select public.set_members_edit_own_subject_only('d0000000-0000-0000-0000-000000000001', false) $$,
  '42501', 'not_owner', 'an editor cannot change it'
);
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.set_members_edit_own_subject_only('d0000000-0000-0000-0000-000000000001', false) $$,
  '42501', 'not_owner', 'a viewer cannot change it'
);
select set_config('request.jwt.claims', '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.set_members_edit_own_subject_only('d0000000-0000-0000-0000-000000000001', false) $$,
  '42501', 'not_owner', 'a non-member cannot change it'
);

-- The owner can, both ways.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.set_members_edit_own_subject_only('d0000000-0000-0000-0000-000000000001', false) $$,
  'the owner turns it off'
);
select is(
  (select members_edit_own_subject_only from public.groups where id = 'd0000000-0000-0000-0000-000000000001'),
  false, 'and it is off'
);
reset role;

select throws_ok(
  $$ select public.set_members_edit_own_subject_only('d0000000-0000-0000-0000-000000000001', null) $$,
  '22004', 'enabled_required', 'it needs on or off'
);

select * from finish();
rollback;
