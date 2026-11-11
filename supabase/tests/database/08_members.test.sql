-- Step 10: changing roles, removing members, leaving and transferring
-- ownership, and what happens to former members' subjects.
begin;
select plan(24);

-- Alex owns "Diet"; Sam edits; Kim, Lee and Max view and track themselves.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local', '{"display_name": "Sam"}'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local', '{"display_name": "Kim"}'),
  ('44444444-4444-4444-4444-444444444444', 'lee@test.local', '{"display_name": "Lee"}'),
  ('55555555-5555-5555-5555-555555555555', 'max@test.local', '{"display_name": "Max"}'),
  ('66666666-6666-6666-6666-666666666666', 'zoe@test.local', '{"display_name": "Zoe"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Diet');
reset role;

insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer'),
  ('d0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'viewer'),
  ('d0000000-0000-0000-0000-000000000001', '55555555-5555-5555-5555-555555555555', 'viewer');
insert into public.subjects (id, group_id, name, linked_user_id) values
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Kim', '33333333-3333-3333-3333-333333333333'),
  ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'Lee', '44444444-4444-4444-4444-444444444444'),
  ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'Max', '55555555-5555-5555-5555-555555555555');
insert into public.attributes (id, group_id, name) values
  ('a1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Weight');
insert into public.entries (subject_id, attribute_id, value, measured_at) values
  ('e0000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 70, '2026-10-01 08:00+00'),
  ('e0000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 80, '2026-10-01 08:00+00'),
  ('e0000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 90, '2026-10-01 08:00+00');

-- Roles (FR-23)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.change_member_role('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'editor') $$,
  'the owner can change a member''s role'
);
select is(
  (select role::text from public.memberships where user_id = '33333333-3333-3333-3333-333333333333'
     and group_id = 'd0000000-0000-0000-0000-000000000001'),
  'editor',
  'the new role is saved'
);
select throws_ok(
  $$ select public.change_member_role('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'owner') $$,
  '22023', 'invalid_role', 'ownership is only given by transferring it'
);
select throws_ok(
  $$ select public.change_member_role('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'viewer') $$,
  'P0001', 'not_a_member', 'the owner''s own role cannot be changed this way'
);

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.change_member_role('d0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'editor') $$,
  '42501', 'not_allowed', 'editors cannot change roles'
);
select throws_ok(
  $$ select public.remove_member('d0000000-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444') $$,
  '42501', 'not_allowed', 'editors cannot remove members'
);

-- Removing (FR-23): entries stay
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.remove_member('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333') $$,
  'the owner can remove a member'
);
select throws_ok(
  $$ select public.remove_member('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111') $$,
  'P0001', 'not_a_member', 'the owner cannot remove themselves'
);
reset role;
select results_eq(
  $$ select s.linked_user_id is null, s.visibility_frozen, (select count(*)::int from public.entries e where e.subject_id = s.id)
     from public.subjects s where s.id = 'e0000000-0000-0000-0000-000000000003' $$,
  $$ values (true, true, 1) $$,
  'a removed member''s subject stays with its entries, unlinked and frozen'
);
select is_empty(
  $$ select 1 from public.memberships where user_id = '33333333-3333-3333-3333-333333333333'
       and group_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'the removed member is no longer a member'
);

-- Leaving (FR-23)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.leave_group('d0000000-0000-0000-0000-000000000001', true) $$,
  'members can leave and keep their entries in the group'
);
select set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.leave_group('d0000000-0000-0000-0000-000000000001', false) $$,
  '...or leave and delete them'
);
select throws_ok(
  $$ select public.leave_group('d0000000-0000-0000-0000-000000000001', true) $$,
  'P0001', 'not_a_member', 'only members can leave'
);
reset role;
select results_eq(
  $$ select s.name, s.linked_user_id is null, s.visibility_frozen,
            (select count(*)::int from public.entries e where e.subject_id = s.id)
     from public.subjects s where s.id = 'e0000000-0000-0000-0000-000000000004' $$,
  $$ values ('Lee', true, true, 1) $$,
  'kept entries stay with the subject, unlinked and frozen'
);
select is_empty(
  $$ select 1 from public.subjects where id = 'e0000000-0000-0000-0000-000000000005' $$,
  'deleting removes the subject and its entries'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.leave_group('d0000000-0000-0000-0000-000000000001', true) $$,
  'P0001', 'owner_cannot_leave', 'the owner cannot leave'
);

-- Former members' subjects can't be claimed when joining (FR-23, FR-22).
insert into public.invites (id, group_id, role, expires_at)
values ('f1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'viewer', now() + interval '1 day');
reset role;
create temporary table tokens on commit drop as
  select id, token from public.invites where id = 'f1000000-0000-0000-0000-000000000001';
grant select on tokens to authenticated;
set local role authenticated;
select is(
  (select subjects from public.get_invite_preview((select token from tokens))),
  '[]'::jsonb,
  'frozen subjects are not offered to joiners'
);
select set_config('request.jwt.claims', '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.accept_invite((select token from tokens), 'request', 'e0000000-0000-0000-0000-000000000004') $$,
  'P0001', 'subject_unavailable', 'frozen subjects cannot be requested'
);

-- Transferring ownership (FR-24)
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.transfer_ownership('d0000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666666') $$,
  'P0001', 'not_a_member', 'ownership goes only to a member'
);
select lives_ok(
  $$ select public.transfer_ownership('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222') $$,
  'the owner can transfer ownership to a member'
);
reset role;
select results_eq(
  $$ select user_id, role::text from public.memberships
     where group_id = 'd0000000-0000-0000-0000-000000000001' order by user_id $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 'editor'),
            ('22222222-2222-2222-2222-222222222222'::uuid, 'owner') $$,
  'the new owner owns it; the former owner becomes an editor'
);
set local role authenticated;
select throws_ok(
  $$ select public.transfer_ownership('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111') $$,
  '42501', 'not_allowed', 'the former owner can no longer transfer it'
);

-- Default groups (FR-13): never transferred; others' members can leave.
reset role;
insert into public.memberships (group_id, user_id, role)
select id, '22222222-2222-2222-2222-222222222222', 'viewer'
from public.groups where default_for_user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select throws_ok(
  $$ select public.transfer_ownership(
       (select id from public.groups where default_for_user_id = '11111111-1111-1111-1111-111111111111'),
       '22222222-2222-2222-2222-222222222222') $$,
  'P0001', 'default_group_cannot_transfer', 'a default group cannot be transferred'
);
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.leave_group(
       (select id from public.groups where default_for_user_id = '11111111-1111-1111-1111-111111111111'), true) $$,
  'a member can leave someone else''s default group'
);

select * from finish();
rollback;
