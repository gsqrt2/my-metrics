-- Step 14: archiving (read-only for everyone) and deleting groups (FR-11),
-- never the default group (FR-13).
begin;
select plan(27);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local', '{"display_name": "Sam"}'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local', '{"display_name": "Kim"}'),
  ('44444444-4444-4444-4444-444444444444', 'lee@test.local', '{"display_name": "Lee"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values
  ('d0000000-0000-0000-0000-000000000001', 'Diet'),
  ('d0000000-0000-0000-0000-000000000002', 'Old');
reset role;
insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer'),
  ('d0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'editor');
insert into public.subjects (id, group_id, name, linked_user_id) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Alex', '11111111-1111-1111-1111-111111111111'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Grandpa', null),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Kim', null);
insert into public.attributes (id, group_id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Weight');
insert into public.entries (id, subject_id, attribute_id, value, measured_at) values
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 80, '2026-10-01 08:00+00');
insert into public.invites (id, group_id, role, expires_at, created_by) values
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'viewer', now() + interval '7 days', '11111111-1111-1111-1111-111111111111');
insert into public.subject_link_requests (id, group_id, subject_id, user_id) values
  ('b1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333333');

-- Only the owner archives, and never the default group.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.set_group_archived('d0000000-0000-0000-0000-000000000001', true) $$,
  '42501', 'not_owner', 'an editor cannot archive'
);
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.set_group_archived((select id from public.groups where default_for_user_id = '11111111-1111-1111-1111-111111111111'), true) $$,
  'P0001', 'default_group', 'the default group cannot be archived'
);
select throws_ok(
  $$ update public.groups set archived_at = now() where id = 'd0000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'archived_at is not a column the app may set'
);
select lives_ok(
  $$ select public.set_group_archived('d0000000-0000-0000-0000-000000000001', true) $$,
  'the owner archives'
);
reset role;
select ok(
  (select archived_at is not null from public.groups where id = 'd0000000-0000-0000-0000-000000000001'),
  'the group is archived'
);
select is(
  (select public.invite_status(i) from public.invites i where id = 'f0000000-0000-0000-0000-000000000001'),
  'revoked', 'its open invites are withdrawn'
);

-- Read-only for everyone, the owner included.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.entries),
  1, 'members still see the entries'
);
select throws_ok(
  $$ insert into public.entries (subject_id, attribute_id, value, measured_at)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 79, '2026-10-02 08:00+00') $$,
  '42501', null, 'no entries are logged'
);
select is_empty(
  $$ update public.entries set value = 1 returning id $$,
  'no entries are changed'
);
select is_empty(
  $$ delete from public.entries returning id $$,
  'no entries are deleted'
);
select throws_ok(
  $$ update public.groups set name = 'Renamed' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'group_archived', 'the group is not edited'
);
select throws_ok(
  $$ insert into public.subjects (group_id, name) values ('d0000000-0000-0000-0000-000000000001', 'New') $$,
  'P0001', 'group_archived', 'no subjects are added'
);
select throws_ok(
  $$ update public.subjects set name = 'Al' where id = 'e0000000-0000-0000-0000-000000000001' $$,
  'P0001', 'group_archived', 'or changed'
);
select throws_ok(
  $$ update public.attributes set name = 'Mass' where id = 'a1000000-0000-0000-0000-000000000001' $$,
  'P0001', 'group_archived', 'no attributes are changed'
);
select throws_ok(
  $$ delete from public.attributes where id = 'a1000000-0000-0000-0000-000000000001' $$,
  'P0001', 'group_archived', 'or deleted'
);
select throws_ok(
  $$ insert into public.invites (group_id, role, expires_at) values ('d0000000-0000-0000-0000-000000000001', 'viewer', now() + interval '7 days') $$,
  'P0001', 'group_archived', 'nobody is invited'
);
select throws_ok(
  $$ select public.set_members_edit_own_subject_only('d0000000-0000-0000-0000-000000000001', true) $$,
  'P0001', 'group_archived', 'the owner setting stays'
);
select throws_ok(
  $$ select public.decide_link_request('b1000000-0000-0000-0000-000000000001', true) $$,
  'P0001', 'group_archived', 'link requests are not approved'
);

-- Privacy stays each person's choice (FR-43): it decides who sees their data.
select lives_ok(
  $$ insert into public.value_visibility (subject_id, attribute_id, visibility)
     values ('e0000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'relative') $$,
  'a linked member still sets their own privacy'
);

-- People can still go.
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.leave_group('d0000000-0000-0000-0000-000000000001', true) $$,
  'members can still leave'
);
reset role;
select throws_ok(
  $$ insert into public.memberships (group_id, user_id, role) values ('d0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer') $$,
  'P0001', 'group_archived', 'nobody joins'
);

-- Restoring makes it editable again.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.set_group_archived('d0000000-0000-0000-0000-000000000001', false) $$,
  'the owner restores'
);
select lives_ok(
  $$ update public.groups set name = 'Diet 2' where id = 'd0000000-0000-0000-0000-000000000001' $$,
  'and it can be edited again'
);

-- Deleting: the owner only, never the default group.
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.delete_group('d0000000-0000-0000-0000-000000000002') $$,
  '42501', 'not_owner', 'an editor cannot delete'
);
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.delete_group((select id from public.groups where default_for_user_id = '11111111-1111-1111-1111-111111111111')) $$,
  'P0001', 'default_group', 'the default group cannot be deleted'
);
select lives_ok(
  $$ select public.delete_group('d0000000-0000-0000-0000-000000000001') $$,
  'the owner deletes a group'
);
reset role;
select is(
  (select count(*)::int from public.entries where id = 'c0000000-0000-0000-0000-000000000001')
  + (select count(*)::int from public.subjects where group_id = 'd0000000-0000-0000-0000-000000000001')
  + (select count(*)::int from public.memberships where group_id = 'd0000000-0000-0000-0000-000000000001'),
  0, 'with everything in it, for all members'
);

select * from finish();
rollback;
