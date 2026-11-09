-- Local demo data, loaded by `supabase db reset` after the migrations.
-- Each implementation step adds the data its feature needs (see plan.md).

-- Demo accounts (step 1). They stand in for the accounts the operator creates
-- by hand in production. Local only: every account's password is "password".
-- The on_auth_user_created trigger creates their profiles.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
  u.email, extensions.crypt('password', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}',
  jsonb_build_object('display_name', u.display_name), now(), now(),
  '', '', '', ''
from (values
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'alex@example.com', 'Alex Example'),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'sam@example.com', 'Sam Example'),
  ('a0000000-0000-0000-0000-000000000003'::uuid, 'kim@example.com', 'Kim Example'),
  ('a0000000-0000-0000-0000-000000000004'::uuid, 'lee@example.com', 'Lee Example'),
  ('a0000000-0000-0000-0000-000000000005'::uuid, 'robin@example.com', 'Robin Example'),
  ('a0000000-0000-0000-0000-000000000006'::uuid, 'pat@example.com', 'Pat Example'),
  ('a0000000-0000-0000-0000-000000000007'::uuid, 'max@example.com', 'Max Example'),
  ('a0000000-0000-0000-0000-000000000008'::uuid, 'jo@example.com', 'Jo Example')
) as u (id, email, display_name);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email like '%@example.com';

-- Demo groups (step 3). Every account already has its "Personal" group from
-- the on_auth_user_created trigger. Alex owns two shared groups; the trigger on
-- groups makes the signed-in user (here: the claims below) the owner.
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001"}', false);

insert into public.groups (id, name, description, starts_on, ends_on) values
  ('b0000000-0000-0000-0000-000000000001', 'Kids',
   'Height and weight of the children, measured on the first Sunday of the month.', null, null),
  ('b0000000-0000-0000-0000-000000000002', 'Diet Challenge',
   'Twelve weeks, weigh-in every Monday morning.', '2026-10-05', '2026-12-27');

select set_config('request.jwt.claims', '', false);

insert into public.memberships (group_id, user_id, role) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'editor'), -- Sam
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000005', 'viewer'), -- Robin
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'editor'), -- Kim
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000004', 'editor'); -- Lee
