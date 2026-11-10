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
  ('a0000000-0000-0000-0000-000000000008'::uuid, 'jo@example.com', 'Jo Example'),
  ('a0000000-0000-0000-0000-000000000009'::uuid, 'ari@example.com', 'Ari Example'),
  ('a0000000-0000-0000-0000-000000000010'::uuid, 'noa@example.com', 'Noa Example'),
  ('a0000000-0000-0000-0000-000000000011'::uuid, 'eli@example.com', 'Eli Example'),
  ('a0000000-0000-0000-0000-000000000012'::uuid, 'tom@example.com', 'Tom Example'),
  ('a0000000-0000-0000-0000-000000000013'::uuid, 'uma@example.com', 'Uma Example'),
  ('a0000000-0000-0000-0000-000000000014'::uuid, 'val@example.com', 'Val Example'),
  ('a0000000-0000-0000-0000-000000000015'::uuid, 'wes@example.com', 'Wes Example'),
  ('a0000000-0000-0000-0000-000000000016'::uuid, 'yan@example.com', 'Yan Example')
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

-- Demo subjects (step 4). Every Personal group already has its user's linked
-- subject. "Kids" tracks two children without accounts (and an archived one);
-- in "Diet Challenge" each member tracks themselves, linked as accepting an
-- invite will do (step 9). Colours are picked by the trigger, in palette order.
insert into public.subjects (id, group_id, name, birthdate, linked_user_id, archived_at) values
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Mia', '2019-04-12', null, null),
  ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Noah', '2022-09-03', null, null),
  ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'Biscuit (dog)', '2020-06-20', null, '2026-08-01'),
  ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'Alex Example', null, 'a0000000-0000-0000-0000-000000000001', null),
  ('c0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Kim Example', null, 'a0000000-0000-0000-0000-000000000003', null),
  ('c0000000-0000-0000-0000-000000000006', 'b0000000-0000-0000-0000-000000000002', 'Lee Example', null, 'a0000000-0000-0000-0000-000000000004', null);

-- Demo attributes, shown as "metrics" (step 5). Personal groups start with
-- none, so they show the suggested attributes. The trigger sets the order.
insert into public.attributes (id, group_id, name, unit, precision, min_value, max_value) values
  ('d1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Height', 'cm', 1, 40, 220),
  ('d1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'Weight', 'kg', 1, 2, 150),
  ('d1000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'Weight', 'kg', 1, 40, 250),
  ('d1000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000002', 'Waist', 'cm', 0, null, null),
  ('d1000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000002', 'Body fat', '%', 1, 0, 70);

-- Demo entries (step 6). The trigger records the signed-in user as who logged
-- them, so the claims below say who that is. Times are 08:00 in Berlin.
-- Kids: Alex measured Mia and Noah on the first of each month for a year.
select set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001"}', false);
insert into public.entries (subject_id, attribute_id, value, measured_at)
select k.subject_id, k.attribute_id,
       round((k.start + k.per_month * m + (random() - 0.5) * k.noise)::numeric, 1),
       (date_trunc('month', date '2025-11-01' + make_interval(months => m)) + time '08:00') at time zone 'Europe/Berlin'
from generate_series(0, 12) m
cross join (values
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000001'::uuid, 119.0, 0.50, 0.4), -- Mia, height
  ('c0000000-0000-0000-0000-000000000001'::uuid, 'd1000000-0000-0000-0000-000000000002'::uuid, 21.8, 0.16, 0.3),   -- Mia, weight
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'd1000000-0000-0000-0000-000000000001'::uuid, 94.5, 0.70, 0.4),  -- Noah, height
  ('c0000000-0000-0000-0000-000000000002'::uuid, 'd1000000-0000-0000-0000-000000000002'::uuid, 14.1, 0.15, 0.3)   -- Noah, weight
) as k (subject_id, attribute_id, start, per_month, noise);

-- Diet Challenge: weekly Monday weigh-ins since the start, each by the member
-- themselves.
create temporary table diet_entries (user_id uuid, subject_id uuid, attribute_id uuid, start numeric, per_week numeric, noise numeric);
insert into diet_entries values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000003', 92.0, -0.6, 0.6), -- Alex, weight
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000004', 104, -0.7, 1.0),  -- Alex, waist
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000003', 74.0, -0.4, 0.5), -- Kim, weight
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000005', 31.0, -0.3, 0.4), -- Kim, body fat
  ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000003', 81.0, -0.5, 0.6); -- Lee, weight

do $$
declare
  member uuid;
begin
  for member in select distinct user_id from diet_entries loop
    perform set_config('request.jwt.claims', json_build_object('sub', member)::text, false);
    insert into public.entries (subject_id, attribute_id, value, measured_at)
    select d.subject_id, d.attribute_id,
           round((d.start + d.per_week * w + (random() - 0.5) * d.noise)::numeric,
                 (select precision from public.attributes where id = d.attribute_id)),
           ((date '2026-10-05' + 7 * w) + time '07:30') at time zone 'Europe/Berlin'
    from diet_entries d
    cross join generate_series(0, ((current_date - date '2026-10-05') / 7)) w
    where d.user_id = member
      and ((date '2026-10-05' + 7 * w) + time '07:30') at time zone 'Europe/Berlin' <= now();
  end loop;
end;
$$;

drop table diet_entries;
select set_config('request.jwt.claims', '', false);

-- Value visibility (step 11): Kim shows the others only the % change of her
-- weight in Diet Challenge (FR-43).
insert into public.value_visibility (subject_id, attribute_id, visibility) values
  ('c0000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000003', 'relative');
