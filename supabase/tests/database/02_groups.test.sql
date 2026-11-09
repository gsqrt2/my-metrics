-- Step 3: groups, memberships, the default group and the groups-per-user limit.
begin;
select plan(25);

-- Alex owns the "Diet" group, Sam edits it, Kim views it, Lee isn't in it.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'lee@test.local');

-- Default group (FR-13)
select results_eq(
  $$ select g.name, m.role::text
     from public.groups g join public.memberships m on m.group_id = g.id
     where g.default_for_user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('Personal', 'owner') $$,
  'a new account gets a "Personal" group that it owns'
);
select throws_ok(
  $$ delete from public.groups where default_for_user_id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001',
  'default_group_protected',
  'a default group cannot be deleted while its account exists'
);

-- Creating a group (FR-10)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.groups (id, name, description, starts_on, ends_on)
     values ('d0000000-0000-0000-0000-000000000001', 'Diet', '12 weeks', '2027-01-04', '2027-03-28') $$,
  'signed-in users can create a group'
);
select results_eq(
  $$ select user_id, role::text from public.memberships where group_id = 'd0000000-0000-0000-0000-000000000001' $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 'owner') $$,
  'the creator becomes the owner'
);
select results_eq(
  'select name from public.groups order by name',
  $$ values ('Diet'), ('Personal') $$,
  'users see the groups they are in'
);
select throws_ok(
  $$ insert into public.groups (name, default_for_user_id) values ('Fake default', '11111111-1111-1111-1111-111111111111') $$,
  '42501',
  null,
  'users cannot create a default group'
);
select throws_ok(
  $$ insert into public.memberships (group_id, user_id, role)
     values ('d0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'editor') $$,
  '42501',
  null,
  'users cannot add members directly'
);
select throws_ok(
  $$ update public.groups set archived_at = now() where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'archiving is not open to the app yet (step 14)'
);

-- Field rules (FR-15, FR-80)
select throws_ok(
  $$ update public.groups set name = '  ' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a name of only spaces is rejected'
);
select throws_ok(
  $$ update public.groups set name = repeat('x', 81) where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'names longer than 80 characters are rejected'
);
select throws_ok(
  $$ update public.groups set description = repeat('x', 501) where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'descriptions longer than 500 characters are rejected'
);
select throws_ok(
  $$ update public.groups set ends_on = null where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a duration needs both a start and an end date'
);
select throws_ok(
  $$ update public.groups set ends_on = '2027-01-03' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a duration cannot end before it starts'
);
select lives_ok(
  $$ update public.groups set starts_on = null, ends_on = null, description = null
     where id = 'd0000000-0000-0000-0000-000000000001' $$,
  'the duration and the description can be removed'
);

-- Sam (editor) and Kim (viewer) join
reset role;
insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');

select throws_ok(
  $$ insert into public.memberships (group_id, user_id, role)
     values ('d0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'owner') $$,
  '23505', null, 'a group has only one owner'
);

-- Editing (FR-11)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);

select results_eq(
  $$ select user_id, role::text from public.memberships
     where group_id = 'd0000000-0000-0000-0000-000000000001' order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 'owner'),
            ('22222222-2222-2222-2222-222222222222'::uuid, 'editor'),
            ('33333333-3333-3333-3333-333333333333'::uuid, 'viewer') $$,
  'members see who is in their group'
);
select lives_ok(
  $$ update public.groups set name = 'Diet Challenge' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  'editors can edit a group'
);
select is(
  (select name from public.groups where id = 'd0000000-0000-0000-0000-000000000001'),
  'Diet Challenge',
  'the editor''s change is saved'
);
-- These updates find no rows they may change; the check below shows nothing changed.
update public.groups set name = 'Sam''s now' where default_for_user_id = '11111111-1111-1111-1111-111111111111';

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
update public.groups set name = 'Kim''s now' where id = 'd0000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
update public.groups set name = 'Lee''s now' where id = 'd0000000-0000-0000-0000-000000000001';
select results_eq(
  'select name from public.groups',
  $$ values ('Personal') $$,
  'non-members see none of the group'
);
select is_empty(
  $$ select 1 from public.memberships where group_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'non-members see none of its members'
);

reset role;
select results_eq(
  $$ select name from public.groups
     where id = 'd0000000-0000-0000-0000-000000000001'
        or default_for_user_id = '11111111-1111-1111-1111-111111111111'
     order by name $$,
  $$ values ('Diet Challenge'), ('Personal') $$,
  'viewers and non-members cannot edit a group, and editors only edit their own groups'
);

set local role anon;
select throws_ok('select 1 from public.groups', '42501', null, 'logged-out visitors cannot read groups');
reset role;

-- Groups per user (FR-80): Kim is in 2 groups, so 48 more reach the limit of 50.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.groups (name) select 'Group ' || n from generate_series(1, 48) n $$,
  'users can be in up to 50 groups'
);
select throws_ok(
  $$ insert into public.groups (name) values ('One too many') $$,
  'P0001', 'group_limit_reached', 'a 51st group is refused'
);
reset role;

-- Account deletion takes the default group along (FR-13, FR-3).
delete from auth.users where id = '44444444-4444-4444-4444-444444444444';
select is_empty(
  $$ select 1 from public.groups where default_for_user_id = '44444444-4444-4444-4444-444444444444' $$,
  'deleting an account deletes its default group'
);

select * from finish();
rollback;
