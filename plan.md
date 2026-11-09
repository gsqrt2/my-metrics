# my-metrics: Implementation Plan

> Companion to [spec.md](spec.md) (what), [features.md](features.md) (feature overview) and [tech.md](tech.md) (how). This file covers **in which order** it's built.

Everything is built and tested locally first (`supabase start` + `vite dev`, see [tech.md §7](tech.md#7-environments--configuration)). Going to the cloud is the last step and only changes configuration.

---

## Progress

**This table is the source of truth for where the project stands.** Read it first when picking the work back up.

- **Open items are added the moment a gap is found:** while building, testing, reviewing or discussing. Don't wait for the end of the step or the next commit.
- **Statuses change when the work does:** 🚧 when a step starts, ✅ when it's merged, ⏸️ when work stops part-way.

Status: ✅ done · 🚧 in progress · ⏸️ paused with open items · ⬜ not started

| Step | Feature | Status | Finished | Commit |
|---|---|---|---|---|
| 0 | Boilerplate and app layout | ✅ | 2026-11-06 | `8017ea6` |
| 1 | Sign-in | ✅ | 2026-11-06 | `9fcd4aa` |
| 2 | Profile | ✅ | 2026-11-06 | `125043f` |
| 3 | Groups | ✅ | 2026-11-09 | `57c8b00` |
| 4 | Subjects | 🚧 | | |
| 5 | Attributes | ⬜ | | |
| 6 | Logging | ⬜ | | |
| 7 | Group dashboard | ⬜ | | |
| 8 | Charts and tables | ⬜ | | |
| 9 | Invitations and joining | ⬜ | | |
| 10 | Managing members and leaving | ⬜ | | |
| 11 | Value visibility | ⬜ | | |
| 12 | "Own subject only" setting, CSV export | ⬜ | | |
| 13 | Email invites | ⬜ | | |
| 14 | Archive and delete groups | ⬜ | | |
| 15 | Account deletion | ⬜ | | |
| 16 | Go live | ⬜ | | |

**Next:** step 4 (Subjects).

### Open items

Anything left unfinished, deferred or worth knowing before the next step. Each item says where it gets resolved. Remove an item when it's done.

- **Current-password check is client-side** (step 2). Supabase doesn't verify `current_password` on password change, so the app checks it with a throwaway sign-in ([verify-password.ts](src/features/profile/verify-password.ts)). It stops mistakes, not someone who already holds the session. Revisit if a server-side check (Edge Function) becomes worth it; see [tech.md §3](tech.md).
- **Cloud auth settings** (steps 1–2). Everything set in `supabase/config.toml` (sign-ups off, minimum password length 8, site/redirect URLs, `double_confirm_changes = false`, email templates, change notifications) has to be repeated in the cloud project. Resolved in step 16.
- **Other members' display names aren't readable yet** (step 3). `profiles` RLS still lets users read only their own profile; the step 1 migration's comment expected this to open up in step 3, but nothing shows other members yet. Add a "members of a shared group can read each other's profile" policy when member names first appear (steps 9–10).
- **End-to-end cleanup goes around the app** (step 3). `deleteOwnedGroups` in `e2e/support/local-supabase.ts` deletes test groups straight from the local database (`pg`), because the app can't delete groups yet. Switch the test to deleting through the app in step 14.
- **`subjects.visibility_frozen` not added yet** (step 4). tech.md's data model has it for former members' subjects (FR-23); it's added with leaving and removing members in step 10.
- **Archived subjects can still be edited** (step 4). FR-32 makes them read-only for *entries*; renaming or recolouring an archived subject is allowed. Step 6 enforces "no new entries" through `can_write_subject`.
- **CI** (2026-11-06): green on `main` (`a1ffb71`). Chromium is cached per Playwright version and installed without `--with-deps`; if a runner image update ever breaks Chromium with missing libraries, add `pnpm exec playwright install-deps chromium` back. The slowest e2e step is now starting Supabase (~80 s).

---

## How we work

**One step = one vertical slice = one branch/PR.** Each step delivers a feature end to end, so the app works after every step.

Each step is done when:

1. **Database:** a new migration in `supabase/migrations/` with tables, constraints (including FR-80 length limits for that step's fields), triggers, RLS policies and SQL functions.
2. **DB tests:** pgTAP tests in `supabase/tests/` for every RLS rule and SQL function added, including the "must be refused" cases.
3. **Types:** `supabase gen types typescript` re-run and committed.
4. **Frontend:** routes, queries (TanStack Query) and screens for the feature, using shadcn/ui components.
5. **Frontend tests:** Vitest for logic (validation, % and age calculations, formatting); one Playwright test for the main user flow.
6. **Seed:** `supabase/seed.sql` extended with demo data for the feature.
7. **Docs:** spec/tech updated if anything was decided along the way; open questions closed in the decision log.
8. **CI green:** lint, type-check, tests, build.
9. **Progress:** the [Progress](#progress) table shows the step as ✅, and its open items are either resolved or still listed. Gaps are added to open items as soon as they're found, not at the end (see [Progress](#progress)). A step stopped part-way is marked ⏸️, with its unfinished tasks listed.

Things deliberately left for later steps are listed under **Not yet** in each step, so nothing is half-built by accident.

---

## Step 0: Boilerplate

Goal: an empty but complete project that runs locally, with the app layout and the full toolchain.

- **Frontend project:** pnpm, Vite + React + TypeScript (strict), Tailwind, shadcn/ui, React Router v8, TanStack Query, React Hook Form + Zod, date-fns. Folder layout as in [tech.md §6](tech.md#6-project-structure). UI text in English, written directly in the components (no i18n library).
- **App layout (design only, not functional):**
  - text-based logo
  - main menu (e.g. Groups, Profile) with placeholder routes
  - a primary action button (placeholder)
  - the main content area, where each route renders
  - responsive: side or top navigation on desktop, compact navigation on phones (mobile-first, spec §1.3)
  - light and dark theme
- **Supabase:** `supabase init`; `config.toml` with sign-ups disabled and email confirmation off (FR-1); empty migrations folder (the first migration comes with step 1); seed file.
- **Supabase client** and query client in `src/lib/`, reading `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `.env.local`; `.env.example` committed.
- **Tooling:** ESLint, Prettier, Vitest + React Testing Library, Playwright, pgTAP (`supabase test db`) — each with one trivial passing test.
- **CI workflow:** lint, type-check, Vitest, `supabase test db`, build on every pull request.
- **README:** how to start the local stack and the app.

**Not yet:** deploy workflow, cloud projects, SMTP.

---

## Step 1: Sign-in (FR-1, partly)

- `profiles` table and the trigger on `auth.users` that creates the profile.
- Login screen (email + password), logout, protected routes (logged-out users are sent to login).
- "Forgot password" with the reset email; locally it lands in Mailpit.
- Seed: two or three demo accounts, standing in for the operator-created first accounts.

**Not yet:** creating accounts from invites (step 9), default group (step 3).

---

## Step 2: Profile (FR-2)

- Profile page: change display name, email and password.
- Email changes are confirmed by a link to the new address, with a notice to the old one; password changes need the current password and send a notice.

**Not yet:** account deletion (step 15), linked subject names following the display name (step 4).

---

## Step 3: Groups (FR-10 – FR-15)

- `groups` and `memberships` tables; trigger that makes the creator the owner; `is_member` and `member_role` helpers; RLS for both tables.
- Group list as the first page after login (FR-12).
- Create and edit a group: name, description, optional duration (FR-14, FR-15).
- Default "Personal" group created with every new account (FR-13), extending the step 1 trigger; it can't be deleted.
- Group page shell where the following steps add subjects, attributes and entries.
- Count limit: groups per user (FR-80).

**Not yet:** archive/delete (step 14), sharing (step 9), duration progress on the dashboard (step 7).

---

## Step 4: Subjects (FR-30 – FR-33)

- `subjects` table, RLS (owner/editor manage).
- Add, edit and archive subjects; archived subjects hidden by default and read-only.
- The default group's subject linked to its user; linked subject names follow the display name until renamed in the group (FR-33).

---

## Step 5: Attributes (FR-40 – FR-42)

- `attributes` table, RLS (owner/editor manage; only the owner deletes attributes that have entries).
- Create, edit, reorder and archive attributes: name, unit, decimals, direction, min/max.
- Suggested attributes in the default group's empty state (FR-13).
- Warning when changing unit or decimals of an attribute with entries.
- Count limit: attributes per group.
- **Decide:** units (spec open question 1) before building the attribute form.

---

## Step 6: Logging (FR-50 – FR-54)

- `entries` table with its triggers: same-group check, min/max on new or changed values, no future timestamps, `created_by`/`updated_by` set by the database, unique timestamp per subject and attribute.
- `can_write_subject` and `can_write_entry` helpers and RLS. `visibility_of` is created now and always returns "actual values"; step 11 makes it real.
- Quick entry: one subject, date and time (default now), several attributes, one comment, saved all-or-nothing.
- Edit and delete entries, with confirmation before deleting; "created by / last changed by" shown.
- Times shown in the viewer's local time zone.

---

## Step 7: Group dashboard (FR-60, FR-66)

- `get_dashboard` SQL function (first, previous and latest entry per subject and attribute).
- Dashboard: latest values, change since previous and since first entry, coloured by direction; recent entries; duration progress if the group has one.
- Empty states for groups without subjects, attributes or entries.

---

## Step 8: Charts and tables (FR-61 – FR-65)

- `get_series` SQL function with both baselines ("first entry" and "since group start").
- Subject view: line chart per attribute, entry table with comments, chart points showing comments.
- Full-screen chart with Week / Month / Year / All and Duration (default when the group has one); date/age switch for subjects with a birthdate.
- Comparison view: one attribute, all subjects; absolute / change / % change.
- Full entry table with filters and sorting.

At this point the app is fully usable for **solo and family tracking**, without sharing.

---

## Step 9: Invitations and joining (FR-1 remainder, FR-20 – FR-22)

- `invites` and `subject_link_requests` tables, RLS.
- Shareable invite links with role, expiry and revoke; list of open invites.
- Invite page: `get_invite_preview` shown to logged-out and logged-in visitors, "Join as ⟨name⟩ / Not you?" for logged-in ones.
- `redeem-invite` Edge Function: creates the account for new invitees (tech.md §3).
- `accept_invite` with the three join choices; owner approves or rejects link requests (`decide_link_request`).
- Count limit: members per group.

**Not yet:** email invites (step 13).

---

## Step 10: Managing members and leaving (FR-23, FR-24)

- Member list with roles.
- Owner: change role, remove member, transfer ownership (`change_member_role`, `remove_member`, `transfer_ownership`).
- Leave group with the keep/delete choice and the export offer (`leave_group`); the export button links to step 12's export once it exists.
- Frozen visibility for kept subjects of former members (`visibility_frozen`).

---

## Step 11: Value visibility (FR-43)

- `value_visibility` table; real `visibility_of`, `can_see_values` and `can_set_visibility`; `entries` read policy and `get_series`/`get_dashboard` updated to return % only for hidden values.
- "Actual values / % only" switch per attribute on your own subject (and on unlinked subjects for those who can log for them).
- Dashboard, charts and comparison show hidden values as % with a "% only" marker; comparison offers only % when anything is hidden; "n/a" when the baseline is 0.
- With "% only", only the linked user can log for that subject and attribute.
- Extensive pgTAP tests: this is the step where a mistake leaks someone's data. Test owners, editors, viewers, former members and frozen subjects.

---

## Step 12: "Own subject only" setting and CSV export (§5, FR-70)

- Owner-only group setting that limits logging to each member's own subject.
- CSV export per group, using `get_series`, with actual values where visible and % where hidden, plus a column saying which.

---

## Step 13: Email invites

- Custom SMTP set up (locally still caught by Mailpit).
- `send-invite` Edge Function: single-use invite bound to an email address.
- Invite form: "send by email" next to the shareable link.
- Password reset emails go through the same SMTP in the cloud.

---

## Step 14: Archive and delete groups (FR-11)

- Owner archives a group (read-only for everyone) or deletes it (removed for all members).
- Default group can't be deleted, left or transferred.

---

## Step 15: Account deletion (FR-3)

- `delete-account` Edge Function.
- Blocked while the user owns other groups, with a list of those groups and ways to resolve each (transfer or delete).
- Confirmation step; default group and own linked subjects deleted; entries logged for others kept without the name.

At this point every feature in [features.md](features.md) is built.

---

## Step 16: Go live

- Supabase cloud project (EU Frankfurt): auth settings matching `config.toml` (sign-ups off, minimum password length, site URL and redirect URLs), the email templates and notifications (password reset, email change, change notices), custom SMTP, Edge Function secrets.
- Firebase Hosting site with the SPA rewrite.
- Deploy workflow on push to `main`: migrations, Edge Functions, hosting.
- Keep-alive workflow (daily) and nightly backup workflow. **Decide:** backup location (tech.md open question 1).
- Create the first account(s) in the Supabase dashboard; smoke-test every main flow in production.

---

## Order at a glance

| Step | Feature | Depends on |
|---|---|---|
| 0 | Boilerplate and app layout | – |
| 1 | Sign-in | 0 |
| 2 | Profile | 1 |
| 3 | Groups (incl. default group, duration) | 1 |
| 4 | Subjects | 3 |
| 5 | Attributes | 3 |
| 6 | Logging | 4, 5 |
| 7 | Group dashboard | 6 |
| 8 | Charts and tables | 6 |
| 9 | Invitations and joining | 4 |
| 10 | Managing members and leaving | 9 |
| 11 | Value visibility | 8, 10 |
| 12 | "Own subject only" setting, CSV export | 6, 11 |
| 13 | Email invites | 9 |
| 14 | Archive and delete groups | 3 |
| 15 | Account deletion | 10, 14 |
| 16 | Go live | all |

Steps 9–10 could come before 7–8 if you want to try sharing with friends early. Value visibility (11) must come before the app is used by more than one person with real data.
