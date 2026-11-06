-- Step 1: user profiles (spec FR-1, FR-2).
-- One row per auth user, created by a trigger when the account is created.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80), -- FR-80
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Other members' display names become readable once groups exist (step 3).
create policy "profiles: users read their own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert or delete policies: rows are created by the trigger below and
-- removed together with the auth user (on delete cascade).

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        split_part(new.email, '@', 1)
      ),
      80
    )
  );
  return new;
end;
$$;

-- Trigger functions must not be callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
