-- Step 4: subjects, their colours, linked names (FR-33) and who may manage them.
begin;
select plan(26);

-- Alex owns the "Kids" group, Sam edits it, Kim views it, Lee isn't in it.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local', '{"display_name": "Sam"}'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'lee@test.local', '{}');

-- The default group's subject (FR-13)
select results_eq(
  $$ select s.name, s.color::text, s.linked_user_id
     from public.subjects s join public.groups g on g.id = s.group_id
     where g.default_for_user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('Alex', 'blue', '11111111-1111-1111-1111-111111111111'::uuid) $$,
  'a new account''s default group has one subject, linked to the user and named after them'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Kids');

reset role;
insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');

-- Adding subjects (FR-30)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.subjects (id, group_id, name, birthdate)
     values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Mia', '2019-04-12') $$,
  'owners can add a subject'
);
insert into public.subjects (group_id, name) values ('d0000000-0000-0000-0000-000000000001', 'Noah');
insert into public.subjects (group_id, name, color) values ('d0000000-0000-0000-0000-000000000001', 'Ava', 'blue');
insert into public.subjects (group_id, name) values ('d0000000-0000-0000-0000-000000000001', 'Leo');
select results_eq(
  $$ select name, color::text from public.subjects
     where group_id = 'd0000000-0000-0000-0000-000000000001' order by created_at, name $$,
  $$ values ('Ava', 'blue'), ('Leo', 'aqua'), ('Mia', 'blue'), ('Noah', 'orange') $$,
  'a subject without a colour gets the least used one, in palette order; a chosen colour is kept'
);

select throws_ok(
  $$ insert into public.subjects (group_id, name, linked_user_id)
     values ('d0000000-0000-0000-0000-000000000001', 'Lee', '44444444-4444-4444-4444-444444444444') $$,
  '42501', null, 'subjects cannot be linked to a user by the app'
);
select throws_ok(
  $$ update public.subjects set name_customized = true where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'the app cannot set whether a name is customized'
);
select throws_ok(
  $$ delete from public.subjects where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'subjects are archived, not deleted'
);

-- Field rules (FR-80)
select throws_ok(
  $$ update public.subjects set name = '  ' where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a name of only spaces is rejected'
);
select throws_ok(
  $$ update public.subjects set name = repeat('x', 81) where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'names longer than 80 characters are rejected'
);
select throws_ok(
  $$ update public.subjects set birthdate = '1899-12-31' where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'birthdates before 1900 are rejected'
);
select throws_ok(
  $$ update public.subjects set color = 'black' where id = 'e0000000-0000-0000-0000-000000000001' $$,
  '22P02', null, 'only palette colours are allowed'
);

-- Editors manage subjects (§5)
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.subjects (group_id, name) values ('d0000000-0000-0000-0000-000000000001', 'Zoe') $$,
  'editors can add a subject'
);
select lives_ok(
  $$ update public.subjects set name = 'Mia Rose', color = 'violet', archived_at = now()
     where id = 'e0000000-0000-0000-0000-000000000001' $$,
  'editors can edit and archive a subject'
);
select results_eq(
  $$ select name, color::text, archived_at is not null from public.subjects where id = 'e0000000-0000-0000-0000-000000000001' $$,
  $$ values ('Mia Rose', 'violet', true) $$,
  'the editor''s changes are saved'
);
select lives_ok(
  $$ update public.subjects set archived_at = null where id = 'e0000000-0000-0000-0000-000000000001' $$,
  'an archived subject can be restored'
);

-- Viewers and non-members
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.subjects where group_id = 'd0000000-0000-0000-0000-000000000001'),
  5,
  'viewers see the group''s subjects'
);
select throws_ok(
  $$ insert into public.subjects (group_id, name) values ('d0000000-0000-0000-0000-000000000001', 'Kim''s pick') $$,
  '42501', null, 'viewers cannot add subjects'
);
update public.subjects set name = 'Renamed by Kim' where id = 'e0000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select is_empty(
  $$ select 1 from public.subjects where group_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'non-members see none of the group''s subjects'
);
select throws_ok(
  $$ insert into public.subjects (group_id, name) values ('d0000000-0000-0000-0000-000000000001', 'Intruder') $$,
  '42501', null, 'non-members cannot add subjects'
);
update public.subjects set name = 'Renamed by Lee' where id = 'e0000000-0000-0000-0000-000000000001';

reset role;
select is(
  (select name from public.subjects where id = 'e0000000-0000-0000-0000-000000000001'),
  'Mia Rose',
  'viewers and non-members cannot edit subjects'
);

-- Linked subjects (FR-31, FR-33). Sam joins with a linked subject, as
-- accepting an invite will do in step 9.
insert into public.subjects (id, group_id, name, linked_user_id)
values ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Sam', '22222222-2222-2222-2222-222222222222');

select throws_ok(
  $$ insert into public.subjects (group_id, name, linked_user_id)
     values ('d0000000-0000-0000-0000-000000000001', 'Sam again', '22222222-2222-2222-2222-222222222222') $$,
  '23505', null, 'a user is linked to at most one subject per group'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
update public.profiles set display_name = 'Samantha' where id = '22222222-2222-2222-2222-222222222222';
select results_eq(
  $$ select s.name from public.subjects s
     where s.linked_user_id = '22222222-2222-2222-2222-222222222222' order by s.name $$,
  $$ values ('Samantha'), ('Samantha') $$,
  'linked subjects follow the display name, in every group'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
update public.subjects set name = 'Sam (Mum)' where id = 'e0000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
update public.profiles set display_name = 'Sam S.' where id = '22222222-2222-2222-2222-222222222222';
select results_eq(
  $$ select s.name, s.group_id = 'd0000000-0000-0000-0000-000000000001' from public.subjects s
     where s.linked_user_id = '22222222-2222-2222-2222-222222222222' order by 2 $$,
  $$ values ('Sam S.', false), ('Sam (Mum)', true) $$,
  'a subject renamed in its group keeps its name; the user''s other subjects still follow'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
update public.subjects set name = 'Sam S.' where id = 'e0000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
update public.profiles set display_name = 'Sam Smith' where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select name from public.subjects where id = 'e0000000-0000-0000-0000-000000000002'),
  'Sam Smith',
  'renaming a subject back to the display name makes it follow again'
);
select is(
  (select name from public.subjects where id = 'e0000000-0000-0000-0000-000000000001'),
  'Mia Rose',
  'a display name change leaves unlinked subjects alone'
);

reset role;
-- Account deletion (FR-3)
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is_empty(
  $$ select 1 from public.subjects where linked_user_id = '22222222-2222-2222-2222-222222222222' $$,
  'deleting an account deletes its linked subjects'
);
select is(
  (select count(*)::int from public.subjects where group_id = 'd0000000-0000-0000-0000-000000000001'),
  5,
  '...and leaves the group''s other subjects'
);

select * from finish();
rollback;
