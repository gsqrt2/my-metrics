-- Step 2: display names can be edited, so a name of only spaces must be
-- rejected too, not just an empty one. The app trims names before saving.

alter table public.profiles
  add constraint profiles_display_name_not_blank check (btrim(display_name) <> '');
