-- Step 5: attributes, their order, field rules, limit and who may manage them.
begin;
select plan(26);

-- Alex owns "Diet", Sam edits it, Kim views it, Lee isn't in it.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alex@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'sam@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'kim@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'lee@test.local');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
insert into public.groups (id, name) values ('d0000000-0000-0000-0000-000000000001', 'Diet');
reset role;
insert into public.memberships (group_id, user_id, role) values
  ('d0000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'editor'),
  ('d0000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'viewer');

-- Adding (FR-40)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);

select lives_ok(
  $$ insert into public.attributes (id, group_id, name, unit, min_value, max_value)
     values ('a1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
             'Weight', 'kg', 30, 250) $$,
  'owners can add an attribute'
);
insert into public.attributes (id, group_id, name, unit, precision)
values ('a1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Waist', 'cm', 0);
insert into public.attributes (id, group_id, name)
values ('a1000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Mood');

select results_eq(
  $$ select name, sort_order, precision::int, unit
     from public.attributes where group_id = 'd0000000-0000-0000-0000-000000000001' order by sort_order $$,
  $$ values ('Weight', 0, 1, 'kg'), ('Waist', 1, 0, 'cm'), ('Mood', 2, 1, null) $$,
  'new attributes go to the end; precision 1 and no unit by default'
);
select throws_ok(
  $$ insert into public.attributes (group_id, name) values ('d0000000-0000-0000-0000-000000000001', ' weight ') $$,
  '23505', null, 'names are unique within a group, ignoring case and spaces'
);
select throws_ok(
  $$ insert into public.attributes (group_id, name, sort_order) values ('d0000000-0000-0000-0000-000000000001', 'Steps', 9) $$,
  '42501', null, 'the app cannot choose the sort order when adding'
);

-- Field rules (FR-40, FR-80)
select throws_ok(
  $$ update public.attributes set name = '  ' where id = 'a1000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a name of only spaces is rejected'
);
select throws_ok(
  $$ update public.attributes set name = repeat('x', 81) where id = 'a1000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'names longer than 80 characters are rejected'
);
select throws_ok(
  $$ update public.attributes set unit = repeat('x', 21) where id = 'a1000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'units longer than 20 characters are rejected'
);
select throws_ok(
  $$ update public.attributes set unit = ' ' where id = 'a1000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'a unit of only spaces is rejected (no unit is null)'
);
select throws_ok(
  $$ update public.attributes set precision = 5 where id = 'a1000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'at most 4 decimals'
);
select throws_ok(
  $$ update public.attributes set min_value = 300 where id = 'a1000000-0000-0000-0000-000000000001' $$,
  '23514', null, 'the minimum cannot be above the maximum'
);

-- Editors manage attributes (§5)
select set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select lives_ok(
  $$ update public.attributes set name = 'Body weight', unit = 'lb', precision = 2, min_value = null
     where id = 'a1000000-0000-0000-0000-000000000001' $$,
  'editors can edit an attribute'
);
select lives_ok(
  $$ update public.attributes set archived_at = now() where id = 'a1000000-0000-0000-0000-000000000003' $$,
  'editors can archive an attribute'
);
select lives_ok(
  $$ select public.reorder_attributes('d0000000-0000-0000-0000-000000000001',
       array['a1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001']::uuid[]) $$,
  'editors can reorder attributes'
);
select results_eq(
  $$ select name, sort_order from public.attributes
     where group_id = 'd0000000-0000-0000-0000-000000000001' order by sort_order $$,
  $$ values ('Waist', 0), ('Body weight', 1), ('Mood', 4) $$,
  'listed attributes take the given order; unlisted ones stay after them'
);
select lives_ok(
  $$ delete from public.attributes where id = 'a1000000-0000-0000-0000-000000000003' $$,
  'editors can delete an attribute without entries'
);
select is(
  (select count(*)::int from public.attributes where group_id = 'd0000000-0000-0000-0000-000000000001'),
  2,
  'the deleted attribute is gone'
);

-- Viewers and non-members
select set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is(
  (select count(*)::int from public.attributes where group_id = 'd0000000-0000-0000-0000-000000000001'),
  2,
  'viewers see the group''s attributes'
);
select throws_ok(
  $$ insert into public.attributes (group_id, name) values ('d0000000-0000-0000-0000-000000000001', 'Steps') $$,
  '42501', null, 'viewers cannot add attributes'
);
select throws_ok(
  $$ select public.reorder_attributes('d0000000-0000-0000-0000-000000000001',
       array['a1000000-0000-0000-0000-000000000001']::uuid[]) $$,
  '42501', null, 'viewers cannot reorder attributes'
);
update public.attributes set name = 'Kim''s pick' where id = 'a1000000-0000-0000-0000-000000000001';
delete from public.attributes where id = 'a1000000-0000-0000-0000-000000000002';

select set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}', true);
select is_empty(
  $$ select 1 from public.attributes where group_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'non-members see none of the group''s attributes'
);
select throws_ok(
  $$ insert into public.attributes (group_id, name) values ('d0000000-0000-0000-0000-000000000001', 'Intruder') $$,
  '42501', null, 'non-members cannot add attributes'
);
select throws_ok(
  $$ select public.reorder_attributes('d0000000-0000-0000-0000-000000000001',
       array['a1000000-0000-0000-0000-000000000001']::uuid[]) $$,
  '42501', null, 'non-members cannot reorder attributes'
);
update public.attributes set name = 'Lee''s pick' where id = 'a1000000-0000-0000-0000-000000000001';
delete from public.attributes where id = 'a1000000-0000-0000-0000-000000000002';

reset role;
select results_eq(
  $$ select name from public.attributes
     where group_id = 'd0000000-0000-0000-0000-000000000001' order by sort_order $$,
  $$ values ('Waist'), ('Body weight') $$,
  'viewers and non-members cannot edit or delete attributes'
);

-- Attributes per group (FR-80): 2 exist, so 98 more reach the limit of 100.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
select lives_ok(
  $$ insert into public.attributes (group_id, name)
     select 'd0000000-0000-0000-0000-000000000001', 'Metric ' || n from generate_series(1, 98) n $$,
  'a group can have up to 100 attributes'
);
select throws_ok(
  $$ insert into public.attributes (group_id, name) values ('d0000000-0000-0000-0000-000000000001', 'One too many') $$,
  'P0001', 'attribute_limit_reached', 'a 101st attribute is refused'
);
select is(
  (select max(sort_order) from public.attributes where group_id = 'd0000000-0000-0000-0000-000000000001'),
  99,
  'each added attribute goes after the last one'
);
reset role;

select * from finish();
rollback;
