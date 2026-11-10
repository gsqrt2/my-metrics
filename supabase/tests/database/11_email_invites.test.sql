-- Step 13: invites by email (FR-20): single use, only for their address.
begin;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local', '{"display_name": "Sam"}'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local', '{"display_name": "Kim"}'),
  ('44444444-4444-4444-4444-444444444444', 'lee@test.local', '{"display_name": "Lee"}'),
  ('55555555-5555-5555-5555-555555555555', 'max@test.local', '{"display_name": "Max"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Diet');
reset role;
insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');

-- Who may invite by email: owners and editors, like links.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.invites (id, group_id, role, email, expires_at)
     values ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'viewer', 'lee@test.local', now() + interval '7 days') $$,
  'an editor invites by email'
);
select throws_ok(
  $$ insert into public.invites (group_id, role, email, expires_at)
     values ('d0000000-0000-0000-0000-000000000001', 'viewer', 'Lee@Test.local ', now() + interval '7 days') $$,
  '23514', null, 'addresses are stored trimmed and in lower case'
);
select throws_ok(
  $$ insert into public.invites (group_id, role, email, expires_at)
     values ('d0000000-0000-0000-0000-000000000001', 'viewer', 'not an address', now() + interval '7 days') $$,
  '23514', null, 'and must look like an address'
);
select throws_ok(
  $$ insert into public.invites (group_id, role, email, expires_at)
     values ('d0000000-0000-0000-0000-000000000001', 'viewer', 'kim@test.local', now() + interval '7 days') $$,
  'P0001', 'already_member', 'members are not invited again'
);

-- A new invite to the same address replaces the open one.
select lives_ok(
  $$ insert into public.invites (id, group_id, role, email, expires_at)
     values ('f0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'editor', 'lee@test.local', now() + interval '7 days') $$,
  'inviting the same address again'
);
reset role;
select is(
  (select public.invite_status(i) from public.invites i where id = 'f0000000-0000-0000-0000-000000000001'),
  'revoked', 'withdraws the earlier invite'
);

select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$ insert into public.invites (group_id, role, email, expires_at)
     values ('d0000000-0000-0000-0000-000000000001', 'viewer', 'zoe@test.local', now() + interval '7 days') $$,
  '42501', null, 'viewers cannot invite'
);

-- Only that address can use it, once. (The token is in the link; read it
-- here, since only the owner and the sender can see invites.)
reset role;
create temp table tokens as select id, token from public.invites;
grant select on tokens to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.accept_invite((select token from tokens where id = 'f0000000-0000-0000-0000-000000000002'), 'none') $$,
  'P0001', 'invite_for_other_email', 'someone else cannot use it'
);
reset role;
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$ select public.accept_invite((select token from tokens where id = 'f0000000-0000-0000-0000-000000000002'), 'none') $$,
  'the invited address joins'
);
reset role;
select is(
  (select role::text from public.memberships where user_id = '44444444-4444-4444-4444-444444444444' and group_id = 'd0000000-0000-0000-0000-000000000001'),
  'editor', 'with the role of the newest invite'
);
select is(
  (select public.invite_status(i) from public.invites i where id = 'f0000000-0000-0000-0000-000000000002'),
  'used', 'and the invite is used up'
);

-- At most 20 email invites a day per sender.
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;
insert into public.invites (group_id, role, email, expires_at)
select 'd0000000-0000-0000-0000-000000000001', 'viewer', 'friend' || n || '@test.local', now() + interval '1 day'
from generate_series(1, 20) n;
select throws_ok(
  $$ insert into public.invites (group_id, role, email, expires_at)
     values ('d0000000-0000-0000-0000-000000000001', 'viewer', 'friend21@test.local', now() + interval '1 day') $$,
  'P0001', 'email_invite_limit', 'the 21st email invite of the day is refused'
);
reset role;

select * from finish();
rollback;
