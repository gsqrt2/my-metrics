-- Step 7 (decided 2026-11-09): the app tracks without judging progress, so
-- attributes no longer say which way is "better" (FR-40, FR-60).

alter table public.attributes drop column direction;
drop type public.attribute_direction;
