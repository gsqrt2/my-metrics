# my-metrics: Technical Design (Draft v0.2)

> Companion to [spec.md](spec.md), which describes the product. This file describes how it is built. Items marked **[OPEN]** are undecided.

---

## 1. Architecture

```
Browser (React SPA)
  │  static files                       │  supabase-js (HTTPS)
  ▼                                     ▼
Firebase Hosting (GCP)         Supabase (EU, Frankfurt)
                                 ├─ Auth (email/password, invite-only)
                                 ├─ Postgres (tables, RLS, SQL functions, triggers)
                                 ├─ Auto-generated REST API (PostgREST)
                                 └─ Edge Functions (invite redemption, invite emails, account deletion)
                                        │
                                        ▼
                               Custom SMTP (own hosting provider)

GitHub Actions: CI, deploys, keep-alive ping, nightly backup
```

- There's **no custom backend server**. The SPA talks directly to Supabase.
- **Authorization is enforced in the database** through Row-Level Security (RLS), never only in the frontend.
- Business rules live in Postgres: constraints, triggers and SQL functions called via RPC.

---

## 2. Stack

| Area | Choice |
|---|---|
| Language | TypeScript (strict) |
| Tooling runtime | Node.js 26 LTS (pinned in `.nvmrc`; minimum 22.22) |
| Package manager | pnpm 10 |
| Build tool | Vite |
| UI library | React |
| Routing | React Router v8 (SPA / data mode) |
| Server state | TanStack Query (wrapping supabase-js) |
| Styling / components | Tailwind CSS + shadcn/ui |
| Forms & validation | React Hook Form + Zod |
| Charts | Recharts (through shadcn/ui chart components) |
| Dates | date-fns |
| Backend platform | Supabase: Postgres, Auth, Edge Functions (Deno/TypeScript) |
| DB types | Generated with `supabase gen types typescript` |
| Frontend hosting | Firebase Hosting (Spark plan, free) |
| Email | Custom SMTP on the owner's hosting provider: configured in Supabase Auth (password reset) and as Edge Function secrets (invite emails) |
| Unit / component tests | Vitest + React Testing Library |
| E2E tests | Playwright |
| DB / RLS tests | pgTAP (`supabase test db`) |
| Lint / format | ESLint + Prettier |
| CI/CD | GitHub Actions |

---

## 3. Authentication & Accounts

### Invite-only sign-up (spec FR-1)
- "Allow new users to sign up" is **turned off** in Supabase Auth, so the public sign-up endpoint can't create accounts.
- "Confirm email" is **off**: receiving an invite is treated as proof of the address.
- New accounts are created by the **`redeem-invite` Edge Function**, which runs with the service role:
  1. It checks the invite token: valid, not expired or revoked, and for email invites not yet used.
  2. It creates the auth user with the admin API (email + password, email marked as confirmed).
  3. It calls `accept_invite` for the new user (§5).
- **Email/password is the only provider.** All OAuth providers (Google included) stay disabled in Supabase Auth.
- The **operator** creates the first account(s) in the Supabase dashboard.

### Other auth flows
- **Sessions:** supabase-js keeps the session in `localStorage` and refreshes it automatically. An `AuthProvider` listens to `onAuthStateChange`; a `RequireAuth` route wrapper sends logged-out visitors to `/login` and back to the requested page afterwards.
  - The session's user (email, pending email) is a copy stored with the tokens and only renewed with the access token, up to an hour later. So on start and whenever the tab becomes visible again, `AuthProvider` asks the server for the current user (`getUser`) and refreshes the session if the email differs, e.g. after an email change confirmed on another device. If the session was ended elsewhere (logout ends all of an account's sessions), this check logs the tab out too.
- **Passwords:** at least 8 characters (`minimum_password_length` in `config.toml`, mirrored in the frontend validation).
- **Password reset** uses Supabase Auth's reset email, sent through the custom SMTP provider.
  - The email uses our own template (`supabase/templates/recovery.html`). Its link goes straight to the app, `/reset-password?token_hash=…&type=recovery`, and the page calls `supabase.auth.verifyOtp`. Unlike the default link, this works when the email is opened on another device than the one that requested it, and link scanners in mail clients can't use up the token, because verifying needs JavaScript.
  - The same template and subject must be set in the cloud project (step 16).
  - The request form always shows the same confirmation, so it doesn't reveal which addresses have accounts.
- **Seed accounts (local only):** `alex`, `sam`, `kim`, `lee`, `robin`, `pat`, `max`, `jo`, `ari`, `noa` and `eli`, all `@example.com` and all with the password `password`, created in `supabase/seed.sql`. The end-to-end tests that change an account each use their own (see `e2e/support/local-supabase.ts`).
- **Profile changes** (spec FR-2): display name in `profiles`; password and email through `supabase.auth.updateUser`.
  - **Email change:** `double_confirm_changes = false`, so only the new address confirms. Its email uses our template (`supabase/templates/email_change.html`) with a `token_hash` link to `/confirm-email`, which calls `verifyOtp({ type: 'email_change' })`, like the password reset. Until then, the pending address is in `user.new_email` and the profile page shows it. The `email_changed` notification then goes to the old address.
  - **Password change:** the `password_changed` notification is on. Supabase's `updateUser` doesn't check the current password, so the profile page checks it first with a throwaway login (`verify-password.ts`), whose session it ends right away. This protects against someone using an unlocked device, but it isn't a server-side check: a stolen session token could still change the password directly. Supabase's `secure_password_change` (re-authentication by emailed code) would close that gap, at the cost of an extra email step.
  - Supabase sends at most one email per account per second (`max_frequency`). Locally, the hourly email limit is raised to 100 for tests; the cloud project keeps its own limit.
- A trigger on `auth.users` creates the `profiles` row and the user's **default group** (spec FR-13), in one transaction:
  - a `groups` row named "Personal", with `default_for_user_id` set to the user
  - an `owner` membership for the user
  - a subject linked to the user, named after their display name
- The suggested attributes in the default group's empty state are defined in the frontend, not in the database.

### Account deletion (spec FR-3)
The `delete-account` Edge Function needs the service role key, because deleting from `auth.users` requires it.
1. It refuses while the user owns any group other than their default group.
2. It deletes the default group and the user's linked subjects in other groups, together with their entries.
3. Foreign keys handle the rest:
   - `profiles` → `auth.users`: on delete cascade
   - `memberships.user_id`: on delete cascade
   - `entries.created_by`: on delete set null

### Invite emails (spec FR-20)
- The `send-invite` Edge Function checks that the caller is the group's owner or an editor. It then creates an `invites` row with `email` set, and sends the link through the custom SMTP provider.
- The SMTP credentials are stored as Edge Function secrets. Supabase Auth's SMTP settings only cover auth emails, so the function needs its own copy.

---

## 4. Data Model

All IDs are `uuid`. All tables have `created_at timestamptz default now()`.

```
profiles      id (= auth.users.id), display_name

groups        id, name, description, archived_at,
              starts_on date null, ends_on date null,             -- FR-15; both set or both null, ends_on >= starts_on
              members_edit_own_subject_only boolean default false,
              default_for_user_id → profiles null UNIQUE          -- FR-13: set only on a user's default group

memberships   group_id → groups, user_id → profiles,
              role ('owner' | 'editor' | 'viewer')
              PK (group_id, user_id)
              -- exactly one 'owner' per group (partial unique index)

invites       id, group_id → groups, token (random, unique), role ('editor' | 'viewer'),
              email text null,                                    -- email invites: single use, bound to this address
              expires_at, revoked_at, accepted_at, created_by → profiles

subjects      id, group_id → groups, name, birthdate date null (>= 1900),
              color subject_color,                                -- enum, the 8 palette colours in order
              linked_user_id → profiles null, archived_at,
              name_customized boolean default false,              -- FR-33: stop following the display name
              visibility_frozen boolean default false             -- FR-23: former member's subject (added in step 10)
              UNIQUE (group_id, linked_user_id)

subject_link_requests                                             -- FR-22
              id, subject_id → subjects, user_id → profiles,
              status ('pending' | 'approved' | 'rejected'), decided_by → profiles null, decided_at
              UNIQUE (subject_id) WHERE status = 'pending'

attributes    id, group_id → groups, name, unit, precision smallint default 1,
              min_value, max_value, sort_order, archived_at

value_visibility                                                  -- FR-43; no row = 'absolute'
              subject_id → subjects, attribute_id → attributes,
              visibility ('absolute' | 'relative')
              PK (subject_id, attribute_id)

entries       id, subject_id → subjects, attribute_id → attributes,
              value numeric, measured_at timestamptz, comment text null,
              created_by → profiles, updated_by → profiles, updated_at
              UNIQUE (subject_id, attribute_id, measured_at)      -- FR-54
              INDEX  (subject_id, attribute_id, measured_at)
```

Notes:
- `measured_at` is stored as `timestamptz` and shown in the viewer's local time zone (FR-50). `birthdate` is a plain `date`.
- Rejecting future timestamps (FR-53) is done in a trigger, allowing a few minutes of clock skew, because CHECK constraints shouldn't depend on `now()`.
- **`check_entry` trigger** (step 6): same-group check, future check, min/max for new or changed values, and `created_by`/`updated_by` stamping. An update that changes none of value, time or comment is passed through untouched: that's the database's own `on delete set null` when an account is deleted, and stamping it would break the foreign key and block the deletion.
- **Quick entry** is one bulk insert without reading the rows back. Value checks (number, decimals, min/max) run in the form too, with the database as the authority. Values may be typed with a dot or a comma.
- **Profiles of co-members** are readable (`shares_group_with`), so entries can show who logged them. Profiles hold only the display name.
- Triggers on `entries`:
  - check that the subject and attribute belong to the same group
  - check min/max on insert and on changes to `value` only (FR-40)
  - set `created_by`, `updated_by` and `updated_at` from `auth.uid()`, so the client can't fake them
- **FR-33:** a trigger on `profiles` updates the names of linked subjects where `name_customized = false`. A trigger on `subjects` sets `name_customized` whenever a linked subject's name changes: true if the new name differs from the display name, false if it matches, so renaming it back resumes following.
- **Subject colours:** `subject_color` is an enum of the eight categorical chart colours in their fixed, colour-blind-safe order (blue, orange, aqua, yellow, magenta, green, violet, red). A subject inserted without a colour gets the one least used in its group, earliest on a tie (`set_subject_defaults` trigger); the form suggests the same one. The light and dark values are the `--subject-*` tokens in `src/index.css`.
- **Attributes** (step 5): `precision` 0–4 (the `direction` column was dropped in step 7); `unit` free text up to 20 characters or null (no conversion). Names are unique per group, ignoring case and surrounding spaces (unique index on `lower(btrim(name))`). A `before insert` trigger puts new attributes last (`sort_order`) and enforces the limit of 100 per group, locking the group row so neither can be raced. Reordering goes through `reorder_attributes(group_id, ids[])`, `security invoker` so RLS decides, which renumbers in one statement. Suggested attributes are a list in the frontend (`src/features/attributes/suggestions.ts`).
- **Number input**: values typed by users accept a dot or a comma as the decimal separator (`parseDecimal` in `src/lib/numbers.ts`); thousands separators are refused as ambiguous.
- **Subjects aren't deleted by the app** (no delete grant): they're archived (FR-32), and deleted only with their group, with their linked account (`linked_user_id` on delete cascade, FR-3) or when a member leaves (step 10). Only `handle_new_user` and, from step 9, accepting an invite set `linked_user_id`. A birthdate in the future is refused by the form, since a check constraint shouldn't depend on today's date.
- **Limits (FR-80):** text lengths are CHECK constraints (`char_length`). Count limits (groups per user, members per group, attributes per group) are enforced by triggers. Groups per user counts memberships, the default group included; the trigger locks the user's profile row so two parallel joins can't both pass. It raises `group_limit_reached`, which the app turns into a message.
- Age (FR-63) is calculated in the client from `birthdate` and `measured_at`.

---

## 5. Authorization (RLS)

Helper functions (`security definer`, `stable`) avoid recursive policies on `memberships`:

- `is_member(group_id) → boolean`
- `member_role(group_id) → role`
- `visibility_of(subject_id, attribute_id) → 'absolute' | 'relative'`: the `value_visibility` row, or `'absolute'` if there's none
- `can_write_subject(subject_id) → boolean`: false if the subject or its group is archived. Otherwise true if:
  - the subject is linked to `auth.uid()` (any role, viewers included), or
  - the role is owner or editor and the group setting `members_edit_own_subject_only` is off
- `can_write_entry(subject_id, attribute_id) → boolean`: `can_write_subject(subject_id)`, the attribute isn't archived, and if `visibility_of(...) = 'relative'` and the subject is linked, it's linked to `auth.uid()`
- `can_see_values(subject_id, attribute_id) → boolean`: the user is a member **and** one of these holds:
  - `visibility_of(...) = 'absolute'`
  - the subject is linked to `auth.uid()`
  - the subject is unlinked, not `visibility_frozen`, and `can_write_subject(subject_id)`
- `can_set_visibility(subject_id) → boolean`: the subject isn't `visibility_frozen`, and it's either linked to `auth.uid()` or unlinked with `can_write_subject(subject_id)`. **The owner role grants nothing extra here.**

| Table | Read | Insert / update / delete |
|---|---|---|
| groups | member | Insert: any signed-in user. Update: owner or editor; a trigger only lets the owner change `archived_at` and `members_edit_own_subject_only`. Delete: owner |

**Column grants** decide which columns the app can write at all, on top of RLS. `anon` gets nothing on these tables, and `authenticated` gets select plus only the columns listed:
- `groups`: insert `id, name, description, starts_on, ends_on`; update `name, description, starts_on, ends_on`. `default_for_user_id` is only ever set by `handle_new_user`. `archived_at` (step 14) and `members_edit_own_subject_only` (step 12) get their owner-only grants or functions in those steps.
- `memberships`: select only.

**Creating a group:** the app generates the group's `id` (`crypto.randomUUID()`) and inserts without reading the row back. Reading it back (`insert … returning`, or `.insert().select()` in supabase-js) is refused by RLS: the new row is only readable once the owner membership exists, and the trigger that adds it runs after the insert.
| memberships | member of same group | only through SQL functions (see below) |
| invites | owner, and the invite's creator | Insert: owner or editor (role must be `editor` or `viewer`). Revoke: owner, or the invite's creator |
| subjects | member | owner, editor |
| subject_link_requests | owner, and the requester | only through SQL functions |
| attributes | member | Insert/update: owner or editor. Delete: owner, or an editor if the attribute has no entries (`attribute_has_entries` in the policy) |
| value_visibility | member | `can_set_visibility(subject_id)` |
| entries | `can_see_values(subject_id, attribute_id)` | `can_write_entry(subject_id, attribute_id)` |

**SQL functions (RPC)** for multi-step or privileged actions:

- `get_invite_preview(token)`: returns the group name, inviter, role, and the group's unlinked subjects that can be requested (names only), so a non-member can see what they're joining.
- `accept_invite(token, choice, subject_id?)`: checks the invite and creates the membership. For email invites it also checks that the user's email matches `invites.email` and sets `accepted_at`, so the invite can only be used once. Then, depending on `choice` (FR-22):
  - `new`: creates a subject linked to the user
  - `request`: creates a pending `subject_link_requests` row for an unlinked subject that isn't `visibility_frozen`
  - `none`: no subject
- `decide_link_request(request_id, approve)`: owner only. Approving links the subject to the user.
- `change_member_role(group_id, user_id, role)`: owner only.
- `remove_member(group_id, user_id)`: owner only. Keeps the subject's entries, unlinks it, and sets `visibility_frozen = true` (FR-23).
- `leave_group(group_id, keep_entries)`: refused for the owner and for default groups. With `keep_entries`, unlinks the subject and sets `visibility_frozen = true`. Otherwise deletes the subject and its entries.
- `transfer_ownership(group_id, new_owner_id)`: makes sure a group always has exactly one owner. Refused for default groups.

**Triggers:**
- New group: the creator becomes the `owner` membership. For a default group, created when there's no signed-in user, the owner is `default_for_user_id`.
- Default group protection: deleting a group with `default_for_user_id` set is blocked while that profile exists. When the account is deleted, the group goes through the `on delete cascade` from `profiles`.

All data belongs to exactly one group. There are no references between groups, which keeps every RLS check limited to a single group.

Quick entry (FR-51) is a single bulk insert, which runs as one statement, so it either fully succeeds or fully fails.

### Value visibility (spec FR-43)

The setting is per subject and attribute, and each entry row has exactly one subject and one attribute, so RLS can hide actual values by filtering whole rows:

- The `entries` read policy (`can_see_values`) hides rows whose actual values the user may not see. This applies to the owner too.
- `get_series(group_id, from, to, max_points, baseline)` (steps 7–8) is a `security definer` function that checks `is_member` itself and raises `not_a_member` otherwise. It returns per point the value, the change and the % change against the baseline (the first entry ever, or with `baseline = 'group_start'` the first on or after the group's start date), never against the first in the range, so narrowing the range doesn't change the numbers; a baseline of 0 gives no % ("n/a"). With `max_points`, if the busiest line in the range has more entries than that, entries are averaged per day, week or month (the finest that fits) and each point carries its `entry_count`; single entries keep their id and comment. The group page asks for 100 points per line, the full-screen charts for one per 3 pixels of width (100–500). It returns every entry in the range with either `value` (when `can_see_values`) or `pct_change` filled in, never both for hidden rows, plus the comment. The dashboard, charts, comparison and CSV export all use it.
  - `baseline = 'first'`: % change relative to the subject's first entry ever for that attribute.
  - `baseline = 'group_start'` (FR-64, only for groups with a duration): relative to the subject's first entry on or after `starts_on`.
  - `pct_change` is `null` (shown as "n/a") when the baseline value is 0.
- **Group page charts** (step 7): two views. *By metric* uses `get_series` values, one chart per attribute with a line per subject in the subject's colour. *By participant* uses `get_series` % changes, one chart per subject with a line per attribute; attributes take the categorical palette in their sort order (at most 8 per chart, so colours never repeat). The view is remembered per group in browser storage. The charts and Recharts are loaded only on group pages (`React.lazy`).
- `get_dashboard(group_id)` (step 7) returns the first, previous and latest entry per subject and attribute, the entry count and the changes (absolute and %), under the same rules, so the dashboard doesn't load every entry for groups with years of data.
- **Percentages are never stored.** They're calculated at query time, so back-filled entries (FR-53) and edits or deletions of the baseline automatically move it.
- For subjects whose values the user can see, the frontend can also calculate % itself, so the user can switch between actual values and % (same formula).
- Because the policies are checked on every query, changing a visibility setting takes effect on the next data load.
- Known limitation: anyone who knows a member's starting value can work out their actual values from the percentages. This is accepted.

---

## 6. Project Structure

```
/
├─ src/
│  ├─ app/            routes, layouts, providers
│  ├─ features/       groups, subjects, attributes, entries, charts, auth
│  ├─ components/ui/  shadcn/ui components
│  ├─ lib/            supabase client, query client, utils
│  └─ types/          generated database types
├─ supabase/
│  ├─ migrations/     SQL migrations (the source of truth for the schema)
│  ├─ functions/      Edge Functions (redeem-invite, send-invite, delete-account)
│  ├─ tests/          pgTAP tests for RLS and SQL functions
│  └─ seed.sql        local demo data
├─ e2e/               Playwright tests
└─ .github/workflows/
```

---

## 7. Environments & Configuration

- **Local:** `supabase start` (Docker Desktop; on Windows it needs WSL 2) runs the whole Supabase stack locally, and `vite dev` runs the frontend. Local emails are caught by Supabase's built-in mail testing tool (Inbucket/Mailpit).
- **Production:** one Supabase project (EU Frankfurt) and one Firebase Hosting site.
- A second free Supabase project could be added as staging later.

Frontend environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Both are safe to expose; RLS protects the data. The secret/service-role key and the SMTP credentials are only used in Edge Functions and CI.

Firebase Hosting needs an SPA rewrite: all routes go to `/index.html`.

---

## 8. CI/CD & Operations (GitHub Actions)

| Workflow | Trigger | Steps |
|---|---|---|
| CI | pull request | lint, type-check, Vitest, `supabase test db`, build |
| Deploy | push to `main` | `supabase db push` (migrations), deploy Edge Functions, `firebase deploy --only hosting` |
| Keep-alive | daily cron | a light query against Supabase, so the free project isn't paused after 7 days without activity |
| Backup | nightly cron | `pg_dump` saved to off-site storage (a GCS bucket or similar) **[OPEN: where]** |

---

## 9. Free-Tier Constraints

| Service | Relevant limits (check current values) |
|---|---|
| Supabase Free | 500 MB database, 50k monthly active users, ~500k Edge Function calls/month, paused after 7 days without activity, no automatic backups, 2 projects |
| Firebase Hosting (Spark) | ~10 GB storage, ~360 MB/day transfer |
| Supabase Auth email | must use custom SMTP (built-in: 2 emails/hour, team addresses only) |
| Own SMTP provider | check the hosting provider's sending limits per hour/day |

---

## 10. Open Technical Questions

1. Where nightly backups are stored.