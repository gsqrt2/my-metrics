-- Step 9: invites, joining with the three choices, link requests and the
-- members-per-group limit.
begin;
select plan(33);

-- Alex owns "Kids" (Sam edits, Kim views). Lee, Max and Robin will join.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local', '{"display_name": "Sam"}'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local', '{"display_name": "Kim"}'),
  ('44444444-4444-4444-4444-444444444444', 'lee@test.local', '{"display_name": "Lee"}'),
  ('55555555-5555-5555-5555-555555555555', 'max@test.local', '{"display_name": "Max"}'),
  ('66666666-6666-6666-6666-666666666666', 'robin@test.local', '{"display_name": "Robin"}'),
  ('77777777-7777-7777-7777-777777777777', 'zoe@test.local', '{"display_name": "Zoe"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Kids');
reset role;
insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');
insert into public.subjects (id, group_id, name) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Mia'),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Noah'),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Old');
update public.subjects set archived_at = now() where id = 'e0000000-0000-0000-0000-000000000003';

-- Creating invites (FR-20, FR-21)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.invites (id, group_id, role, expires_at)
     values ('f1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'viewer', now() + interval '7 days') $$,
  'owners can create an invite link'
);
select results_eq(
  $$ select char_length(token), created_by from public.invites where id = 'f1000000-0000-0000-0000-000000000001' $$,
  $$ values (24, '11111111-1111-1111-1111-111111111111'::uuid) $$,
  'the database makes the secret token and records who invited'
);
select throws_ok(
  $$ insert into public.invites (group_id, role, expires_at, token)
     values ('d0000000-0000-0000-0000-000000000001', 'viewer', now() + interval '1 day', 'guessable') $$,
  '42501', null, 'the app cannot choose the token'
);
select throws_ok(
  $$ insert into public.invites (group_id, role, expires_at)
     values ('d0000000-0000-0000-0000-000000000001', 'owner', now() + interval '1 day') $$,
  '23514', null, 'invites are for editors or viewers only'
);
select throws_ok(
  $$ insert into public.invites (group_id, role, expires_at)
     values ('d0000000-0000-0000-0000-000000000001', 'viewer', now() - interval '1 minute') $$,
  'P0001', 'invalid_expiry', 'an invite cannot be expired already'
);
select throws_ok(
  $$ insert into public.invites (group_id, role, expires_at)
     values ('d0000000-0000-0000-0000-000000000001', 'viewer', now() + interval '60 days') $$,
  'P0001', 'invalid_expiry', 'invites expire within 30 days'
);

select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.invites (id, group_id, role, expires_at)
     values ('f1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'editor', now() + interval '1 day') $$,
  'editors can invite too'
);
select results_eq(
  'select id from public.invites',
  $$ values ('f1000000-0000-0000-0000-000000000002'::uuid) $$,
  'editors see only the invites they made'
);
update public.invites set revoked_at = now() where id = 'f1000000-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select throws_ok(
  $$ insert into public.invites (group_id, role, expires_at)
     values ('d0000000-0000-0000-0000-000000000001', 'viewer', now() + interval '1 day') $$,
  '42501', null, 'viewers cannot invite'
);
select is_empty('select 1 from public.invites', 'viewers see no invites');

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.invites where revoked_at is null),
  2,
  'owners see every invite, and others cannot revoke the owner''s'
);
select lives_ok(
  $$ update public.invites set revoked_at = now()
     where id in ('f1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000002') $$,
  'owners can revoke any invite'
);
reset role;

-- A fresh viewer invite for the joins below.
insert into public.invites (id, group_id, role, expires_at, created_by)
values ('f1000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'viewer', now() + interval '7 days',
        '11111111-1111-1111-1111-111111111111');
update public.invites set created_by = '11111111-1111-1111-1111-111111111111'
where id = 'f1000000-0000-0000-0000-000000000003';

-- The tokens, readable for the test whatever role it acts as.
create temporary table tokens on commit drop as select id, token from public.invites;
grant select on tokens to anon, authenticated;

-- Previews (before joining)
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select results_eq(
  $$ select status, group_name, inviter_name, role::text, already_member, subjects
     from public.get_invite_preview((select token from tokens where id = 'f1000000-0000-0000-0000-000000000003')) $$,
  $$ values ('valid', 'Kids', 'Alex', 'viewer', false,
             '[{"id": "e0000000-0000-0000-0000-000000000001", "name": "Mia"},
               {"id": "e0000000-0000-0000-0000-000000000002", "name": "Noah"}]'::jsonb) $$,
  'logged-out visitors see the group, the inviter, the role and the subjects without an account'
);
reset role;
select results_eq(
  $$ select status, group_name from public.get_invite_preview((select token from tokens where id = 'f1000000-0000-0000-0000-000000000001')) $$,
  $$ values ('revoked', null::text) $$,
  'a revoked invite says so, without details'
);
select results_eq(
  $$ select status from public.get_invite_preview('no-such-token') $$,
  $$ values ('invalid') $$,
  'an unknown token is invalid'
);

-- Joining with a new subject (FR-22)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select is(
  public.accept_invite((select token from tokens where id = 'f1000000-0000-0000-0000-000000000003'), 'new'),
  'd0000000-0000-0000-0000-000000000001'::uuid,
  'accepting returns the group'
);
reset role;
select results_eq(
  $$ select m.role::text, s.name from public.memberships m
     join public.subjects s on s.group_id = m.group_id and s.linked_user_id = m.user_id
     where m.group_id = 'd0000000-0000-0000-0000-000000000001' and m.user_id = '44444444-4444-4444-4444-444444444444' $$,
  $$ values ('viewer', 'Lee') $$,
  'the joiner becomes a member with the invite''s role and a subject named after them'
);
set local role authenticated;
select is(
  (select already_member from public.get_invite_preview((select token from tokens where id = 'f1000000-0000-0000-0000-000000000003'))),
  true,
  'the preview knows the visitor is already a member'
);
select throws_ok(
  $$ select public.accept_invite((select token from tokens where id = 'f1000000-0000-0000-0000-000000000003'), 'new') $$,
  'P0001', 'already_member', 'members cannot join again'
);

-- Joining with a request to be linked (FR-22)
select set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.accept_invite((select token from tokens where id = 'f1000000-0000-0000-0000-000000000003'), 'maybe') $$,
  '22023', 'invalid_choice', 'only the three choices are allowed'
);
select throws_ok(
  $$ select public.accept_invite((select token from tokens where id = 'f1000000-0000-0000-0000-000000000003'), 'request', 'e0000000-0000-0000-0000-000000000003') $$,
  'P0001', 'subject_unavailable', 'archived subjects cannot be requested'
);
select lives_ok(
  $$ select public.accept_invite((select token from tokens where id = 'f1000000-0000-0000-0000-000000000003'), 'request', 'e0000000-0000-0000-0000-000000000001') $$,
  'joiners can ask to be linked to a subject without an account'
);
select results_eq(
  $$ select status::text from public.subject_link_requests where user_id = '55555555-5555-5555-5555-555555555555' $$,
  $$ values ('pending') $$,
  'requesters see their own request'
);

select set_config('request.jwt.claims', '{"sub": "66666666-6666-6666-6666-666666666666", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.accept_invite((select token from tokens where id = 'f1000000-0000-0000-0000-000000000003'), 'request', 'e0000000-0000-0000-0000-000000000001') $$,
  'P0001', 'subject_unavailable', 'a subject with an open request cannot be requested again'
);
select lives_ok(
  $$ select public.accept_invite((select token from tokens where id = 'f1000000-0000-0000-0000-000000000003'), 'request', 'e0000000-0000-0000-0000-000000000002') $$,
  'another subject can be requested'
);

-- Deciding (FR-22: the owner only)
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is_empty('select 1 from public.subject_link_requests', 'editors see no requests');
select throws_ok(
  $$ select public.decide_link_request((select id from public.subject_link_requests where subject_id = 'e0000000-0000-0000-0000-000000000001'), true) $$,
  '42501', 'not_allowed', 'editors cannot decide requests'
);

select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.decide_link_request((select id from public.subject_link_requests where subject_id = 'e0000000-0000-0000-0000-000000000001'), true) $$,
  'owners can approve a request'
);
select lives_ok(
  $$ select public.decide_link_request((select id from public.subject_link_requests where subject_id = 'e0000000-0000-0000-0000-000000000002'), false) $$,
  'owners can reject a request'
);
reset role;
select results_eq(
  $$ select s.name, s.linked_user_id, s.name_customized, r.status::text
     from public.subjects s join public.subject_link_requests r on r.subject_id = s.id
     where s.id in ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002')
     order by s.name $$,
  $$ values ('Mia', '55555555-5555-5555-5555-555555555555'::uuid, true, 'approved'),
            ('Noah', null::uuid, false, 'rejected') $$,
  'approving links the subject, keeping its name; rejecting leaves it unlinked'
);

-- Revoked and expired invites
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "77777777-7777-7777-7777-777777777777", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.accept_invite((select token from tokens where id = 'f1000000-0000-0000-0000-000000000001'), 'new') $$,
  'P0001', 'invite_invalid', 'revoked invites cannot be accepted'
);
reset role;

-- Members per group (FR-80): 6 members, so 44 more reach the limit of 50.
insert into auth.users (id, email)
select gen_random_uuid(), 'filler' || n || '@test.local' from generate_series(1, 45) n;
insert into public.memberships (group_id, user_id, role)
select 'd0000000-0000-0000-0000-000000000001', u.id, 'viewer'
from auth.users u where u.email like 'filler%' and u.email <> 'filler45@test.local';
select throws_ok(
  $$ insert into public.memberships (group_id, user_id, role)
     select 'd0000000-0000-0000-0000-000000000001', id, 'viewer' from auth.users where email = 'filler45@test.local' $$,
  'P0001', 'member_limit_reached', 'a 51st member is refused'
);

set local role anon;
select throws_ok(
  $$ select public.accept_invite('anything', 'new') $$,
  '42501', null, 'logged-out visitors cannot join'
);

select * from finish();
rollback;
