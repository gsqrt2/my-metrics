-- Step 1: profiles are created with the account and only visible to their owner.
begin;
select plan(9);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam.smith@test.local', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local', jsonb_build_object('display_name', repeat('k', 100)));

-- Profile creation
select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Alex',
  'a new account gets a profile with the display name given at creation'
);
select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'sam.smith',
  'without a display name, the part of the email before the @ is used'
);
select is(
  (select char_length(display_name) from public.profiles where id = '33333333-3333-3333-3333-333333333333'),
  80,
  'a display name longer than 80 characters is shortened at account creation'
);

-- Logged out
set local role anon;
select is_empty('select * from public.profiles', 'logged-out visitors see no profiles');

-- Logged in as Alex
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}',
  true
);

select results_eq(
  'select display_name from public.profiles',
  $$ values ('Alex'::text) $$,
  'users only see their own profile'
);
select lives_ok(
  $$ update public.profiles set display_name = 'Alexandra' where id = '11111111-1111-1111-1111-111111111111' $$,
  'users can change their own display name'
);
select throws_ok(
  $$ update public.profiles set display_name = repeat('x', 81) where id = '11111111-1111-1111-1111-111111111111' $$,
  '23514',
  null,
  'display names longer than 80 characters are rejected'
);
select throws_ok(
  $$ insert into public.profiles (id, display_name) values (gen_random_uuid(), 'Intruder') $$,
  '42501',
  null,
  'users cannot create profiles directly'
);

update public.profiles set display_name = 'Hacked' where id = '22222222-2222-2222-2222-222222222222';

reset role;
select is(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'sam.smith',
  'users cannot change someone else''s profile'
);

select * from finish();
rollback;
