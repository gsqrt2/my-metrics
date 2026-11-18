-- Backlog: members who aren't a participant yet add themselves (track_myself).
begin;
select plan(10);

-- Alex creates "Club" (no participant for anyone yet). Kim views it, Sam
-- edits it and has asked to be linked to "Sammy", Lee isn't in it.
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local', '{"display_name": "Alex"}'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local', '{"display_name": "Sam"}'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local', '{"display_name": "Kim"}'),
  ('44444444-4444-4444-4444-444444444444', 'lee@test.local', '{"display_name": "Lee"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values
  ('d0000000-0000-0000-0000-000000000001', 'Club'),
  ('d0000000-0000-0000-0000-000000000002', 'Old club');
reset role;

insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');
insert into public.subjects (id, group_id, name) values
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Sammy');
insert into public.subject_link_requests (group_id, subject_id, user_id) values
  ('d0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
update public.groups set archived_at = now() where id = 'd0000000-0000-0000-0000-000000000002';

set local role authenticated;

-- The creator
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.track_myself('d0000000-0000-0000-0000-000000000001') $$,
  'the creator of a group adds themselves as a participant'
);
select results_eq(
  $$ select name, name_customized, color is not null from public.subjects
     where group_id = 'd0000000-0000-0000-0000-000000000001'
       and linked_user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('Alex'::text, false, true) $$,
  'the participant is linked, named after the display name (and follows it), with a colour'
);
select throws_ok(
  $$ select public.track_myself('d0000000-0000-0000-0000-000000000001') $$,
  'P0001', 'already_tracked', 'only one participant per member'
);
select throws_ok(
  $$ select public.track_myself('d0000000-0000-0000-0000-000000000002') $$,
  'P0001', 'group_archived', 'not in an archived group'
);

-- A viewer who joined to watch
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select lives_ok(
  $$ select public.track_myself('d0000000-0000-0000-0000-000000000001') $$,
  'viewers add themselves too'
);
select ok(
  public.can_write_subject((select id from public.subjects
    where linked_user_id = '33333333-3333-3333-3333-333333333333'
      and group_id = 'd0000000-0000-0000-0000-000000000001')),
  'and may then log for themselves'
);

-- A member waiting to be linked to an existing participant
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.track_myself('d0000000-0000-0000-0000-000000000001') $$,
  'P0001', 'link_request_pending', 'not while waiting to be linked to a participant'
);

-- Someone outside the group
select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select throws_ok(
  $$ select public.track_myself('d0000000-0000-0000-0000-000000000001') $$,
  'P0001', 'not_allowed', 'non-members cannot add themselves'
);
select is(
  (select count(*)::int from public.subjects where linked_user_id = '44444444-4444-4444-4444-444444444444'
     and group_id = 'd0000000-0000-0000-0000-000000000001'),
  0,
  'and nothing was added'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.track_myself('d0000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'logged-out visitors cannot call it'
);
reset role;

select * from finish();
rollback;
