-- Step 16: new tables, functions and sequences get no rights by default.
--
-- The cloud project has "Automatically expose new tables" turned off, so
-- nothing in the public schema is reachable through the Data API unless a
-- migration grants it. This does the same locally (and in CI), so a missing
-- grant fails the tests here rather than in production. It runs before every
-- other migration; each object grants what it needs right after creating it.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated, service_role;
