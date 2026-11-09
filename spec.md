# my-metrics: Specification (Draft v0.2)

> Status: **Draft for refinement.** Items marked **[OPEN]** are undecided; see [§8 Open Questions](#8-open-questions). Decisions are recorded in [§9 Decision Log](#9-decision-log).

---

## 1. Overview

**my-metrics** is a web app for logging personal, numeric attributes over time (height, weight, waist circumference and so on), viewing how they develop, and sharing the tracking with other people. It's an invite-only app for family and friends.

### 1.1 Motivating use cases

1. **Family growth tracking**: Parents log their children's height and weight over the years and look at growth curves. The children don't have accounts.
2. **Group diet challenge**: A group of friends each log their own weight and body circumferences (waist, hips, chest and so on) and compare progress with each other.
3. **Solo tracking** (implied): One person tracks their own metrics privately.

### 1.2 Goals

- Attributes with custom names are defined by the user, not chosen from a fixed list.
- Tracking is organized into **groups**, which can be **shared** with other users.
- Every entry has a **date and time** and an optional **comment**.
- Progress is easy to see over time and easy to compare between people.
- Each person decides whether others see their actual values or only their % change.

### 1.3 Non-goals (v1)

- Medical advice or diagnostics.
- Integration with wearables or smart scales.
- Native mobile apps. The web app is responsive and mobile-first instead. Nevertheless, follow patterns that will allow porting to mobile native in the future.
- Public sign-up. Accounts are only created through invites (FR-1).

---

## 2. Glossary

| Term | Definition |
|---|---|
| **User** | A person with a login account. |
| **Group** | A tracking space and the **context** that gives its attributes their meaning, e.g. "Growth", "Performance" or "Diet Challenge 2026". It owns its subjects, attributes and entries; all data belongs to exactly one group. A group is private until a member invites someone. The app calls groups **logbooks**; "group" stays the term in this spec and in the code. |
| **Default group** | A private group every user gets automatically when their account is created, so they can start tracking right away. |
| **Member** | A user who has access to a group, with a **role**. |
| **Role** | `owner`, `editor` or `viewer`; see §5. Every group has exactly one owner. |
| **Subject** | Who (or what) is measured within a group. A subject belongs to exactly one group. It can be **linked to a user** (a friend tracking themselves) or **unlinked** (a child without an account). The app calls subjects **participants**; "subject" stays the term in this spec and in the code. |
| **Attribute** | A custom-named metric that exists only within its group. The group gives it its meaning: "Height" in a group "Growth" is how tall the subject is, while "Height" in a group "Performance" is how high the subject can jump. Attributes aren't shared or reused across groups. The app calls attributes **metrics**; "attribute" stays the term in this spec and in the code. |
| **Entry** | One recorded value: subject + attribute + value + date and time (+ optional comment). |
| **Value visibility** | Per subject and attribute: whether other members see the **actual values** or only the **% change** (FR-43). |

**The key distinction is that the people who log in (users) are kept separate from the people being measured (subjects).** This lets both use cases work on the same model:

- *Kids group*: both parents are members (owner + editor), and each child is an unlinked subject.
- *Diet group*: each friend is a member and also a subject linked to their own account.

---

## 3. User Stories

### Family growth tracking
- As a parent, I create a group "Kids" and add my children as subjects, with optional birthdates.
- As a parent, I define the attributes "Height" (cm) and "Weight" (kg).
- As a parent, I invite my partner as an editor so we can both log measurements.
- As a parent, I log a measurement with a date (e.g. from a doctor's visit) and a comment ("U6 check-up").
- As a parent, I see each child's height and weight over time, optionally plotted against age.
- As a parent, I invite grandparents as viewers.

### Group diet challenge
- As a user, I create a group "Diet Challenge" with the attributes Weight, Waist, Hips and Chest, and a duration of 12 weeks.
- As a user, I invite my friends with a link or by email. When they join, each becomes a subject linked to their account.
- As a member, I log my own measurements. I can't edit other people's entries.
- As a member, I set my "Weight" to show only % change, so nobody else, including the owner, sees my actual weight.
- As a member, I see a comparison chart of everyone's progress: actual values where people allow it, and % change where they don't.
- As a member, I can leave the group and choose whether my entries stay or are deleted.

### Solo tracking
- As a new user, I already have a private default group with myself as the subject, and I can pick from suggested attributes to start logging right away.
- As a user, I create more private groups for different contexts (e.g. "Growth" and "Performance") and track my metrics in each.
- As a user, I later share one of my private groups by inviting someone. Its existing data stays as it is.

---

## 4. Functional Requirements

### 4.1 Authentication & accounts
- FR-1: **Invite-only accounts.** There's no public sign-up. A new account can only be created by accepting an invite (FR-20), or by the app operator. Users then log in with **email and password** and can log out. There's no social login (e.g. Google).
  - Email addresses aren't confirmed separately; receiving an invite is enough.
  - Users can reset a forgotten password by email. The reset link works once and expires after an hour. The reset form answers the same way whether or not an account exists for the address.
  - Passwords have at least 8 characters.
- FR-2: Users have a display name and an email address. In their profile, users can change their **display name**, **email address** and **password**.
  - A new email address only takes effect once the user confirms it through a link sent to that address. Until then, they keep logging in with the old one. Afterwards, the old address gets a notice that the address was changed.
  - Changing the password needs the current password. The user gets an email notice after a password change.
- FR-3: Users can delete their account.
  - Deletion is blocked while the user owns groups other than their default group. They must first transfer ownership of each of those groups or delete them.
  - The default group is deleted together with the account.
  - Subjects linked to the user are deleted together with their entries, because they are the user's personal data.
  - Entries the user logged for other subjects are kept, without the reference to who created them.

### 4.2 Groups
- FR-10: A user can create a group with a name, an optional description and an optional duration (FR-15). The creator becomes the `owner`.
- FR-11: The owner and editors can edit a group's name, description and duration. Only the owner can archive (read-only) or delete a group.
- FR-12: A user can see a list of all groups they are a member of. **This list is the first page after logging in.**
- FR-13: **Default group.** When an account is created, a private group named "Personal" is created for the user, with the user as its owner and one subject linked to them. It starts with no attributes; an empty state offers **suggested attributes** (e.g. Weight, Height, Waist) plus "Custom". The default group works like any other group, except:
  - it can be renamed and shared, but not deleted, left or transferred, so every user always has at least one group
  - it's deleted together with the user's account (FR-3)
- FR-14: Groups are private when created. A group is shared only by inviting members (FR-20).
- FR-15: **Duration (optional).** A group can have a start date and an end date, e.g. for a 12-week diet challenge. If both are set:
  - the dashboard shows the progress (e.g. "Day 64 of 84 · 20 days left", or "Ended")
  - charts use the duration as their default date range
  - entries outside the duration are still allowed, e.g. a baseline measured before the start
  - nothing changes automatically when the end date passes; the group stays editable until the owner archives it

### 4.3 Sharing & membership
- FR-20: Owners and editors can invite people as `editor` or `viewer`:
  - through a **shareable invite link** (expiring and revocable), which can be sent through any channel
  - **by email**: the app sends a link that can be used once, only with that email address
  - Whoever created an invite can revoke it, and the owner can revoke any invite.
  - Accepting an invite creates an account for the invitee if they don't have one (FR-1).
- FR-21: An invite specifies a role (`editor` or `viewer`).
- FR-22: When joining, the invitee chooses one of:
  - **create a new subject for myself** (the default)
  - **request to be linked to an existing subject without an account**. The owner must approve the request; until then the invitee has no subject in the group. The owner can also reject it.
  - **no subject** (e.g. grandparents who only want to watch)
- FR-23: Owners can change roles and remove members. Members can leave a group.
  - **Leaving:** the member chooses whether their entries **stay in the group** or are **deleted**, and is offered a CSV export (FR-70) first.
  - **Removed by the owner:** the entries stay in the group.
  - When entries stay, the subject becomes unlinked and keeps its value visibility settings (FR-43) as they were. Nobody can change them afterwards.
  - The owner can't leave their group. They must transfer ownership first (FR-24) or delete the group.
- FR-24: Ownership can be transferred to another member.

### 4.4 Subjects
- FR-30: Editors and owners can add, edit and archive subjects (name, optional birthdate, optional color/avatar).
- FR-31: A subject can be linked to at most one user per group.
- FR-32: Archived subjects keep their entries but are hidden by default and are **read-only**: no new entries can be logged for them until they're restored.
- FR-33: A linked subject's name starts as the user's display name and **follows changes to the display name until it's renamed** in that group. After that it keeps its own name.

### 4.5 Attributes
- FR-40: Owners and editors can create, edit and reorder attributes, with these fields:
  - **name** (free text, required)
  - **unit** (free text, e.g. "cm", "kg"; optional; up to 20 characters). The form suggests common units, but any text is allowed. There's no unit conversion in v1 (§7).
  - **value type**: `number` in v1
  - **precision** (number of decimals; default 1)
  - optional **min/max** for input validation. Limits only apply to new or edited entries; existing entries outside them are kept as they are.
- FR-41: Attributes can be renamed and reordered. Renaming keeps existing entries. Changing the **unit** or **precision** of an attribute that has entries is allowed after a warning that existing entries keep their numbers (so changing kg to lb changes what they mean).
- FR-42: Owners and editors can archive attributes. Archived attributes keep their entries but are hidden by default and are **read-only** until restored. Only the owner can delete an attribute that has entries, after confirmation.
- FR-43: **Value visibility.** For each attribute, each subject has a setting for what other members see: **actual values** (the default) or **% only**.
  - **Who decides:** for a subject linked to a user, only that user. For a subject without an account, the members who can log entries for it (§5). For a former member's subject (FR-23), nobody.
  - **No one else can change it or bypass it, including the owner.**
  - With **% only**, other members see only the **% change** since the subject's first entry for that attribute (or since the group's start, FR-64).
  - The person who decides sees the actual values and can view them as % change too.
  - Switching to actual values shows all past entries; switching to % only hides them immediately.
  - With % only, entries for a linked subject can only be logged and edited by the linked user.
  - Comments stay visible to all members. Users are responsible for not revealing values in their comments.
  - Percentages are always calculated from the current entries. If an earlier entry is back-filled later, it becomes the new baseline and all percentages update. If the baseline value is 0, the % is shown as "n/a".

### 4.6 Entries
- FR-50: An entry has these fields: subject, attribute, numeric value, **date and time** (required, defaults to now), **comment** (optional, free text). The app also records who created the entry and who last changed it, and when. There's no further edit history.
  - Any number is allowed as a value, including 0 and negative numbers, within the attribute's min/max (FR-40).
  - Dates and times are shown in the **viewer's local time zone**.
- FR-51: **Quick entry**: log several attributes for one subject at one date and time in a single form, sharing one comment. The form is the same wherever it's opened from (the "Log entry" button on every page, or inside a group); only its starting values differ:
  - **Group** is always the first field and can be changed. Opened from a group, it starts there; otherwise in the group last logged in on this device, or the only one. Only groups the user can log in are offered (with attributes and a subject they may log for).
  - **Subject** starts as the user's own linked subject in that group, else the one last logged for there.
  - **Date and time** start at now; then one field per attribute (left empty if not measured) and one comment.
  - Changing the group asks before discarding values already typed in. All values are saved together or none is.
- FR-52: Entries can be edited and deleted (subject to permissions, §5). Deleting asks for confirmation and is **permanent**; there's no undo.
- FR-53: Past dates and times are allowed, so historical data can be back-filled. Future dates and times are rejected.
- FR-54: A subject can have several entries for the same attribute on the same day, as long as they are at different times (e.g. weight in the morning and in the evening). Two entries for the same subject and attribute at the identical date and time are not allowed. Charts show every entry.

### 4.7 Views & visualization
- FR-60: **Group dashboard**: the group page leads with charts, in one of two views the user can switch between (remembered per group on each device):
  - **By attribute** (the default): a chart per attribute with every subject's values over time, in the attribute's unit. Subjects can be filtered, e.g. to focus on one child.
  - **By subject**: a chart per subject with every attribute as its **% change since its first entry**, so attributes with different units share one scale; the actual values with their units show on hover and below the chart. Attributes can be filtered. Attributes whose first value is 0 can't be shown as % change and are listed instead.
  - With a single subject there's no switch: both views would be the same.
  - Each chart lists, per line, the latest value and the change since the previous and the first entry, shown objectively (arrow and sign), without judging it as good or bad.
  - Recent entries follow below the charts, as secondary information. Values hidden under FR-43 are shown as % change.
- FR-61: **Subject view**: a line chart per attribute over time, plus a table of entries with comments. Selecting a point shows its comment. Values hidden under FR-43 are shown as % change.
  - Selecting an attribute's chart (on the dashboard or in the subject view) opens it **full screen**. The full-screen chart has the time span options of FR-64, the x-axis choice of FR-63, the latest value and the change within the selected span, and a table of the entries in that span.
- FR-62: **Comparison view**: one attribute with all subjects overlaid. The axis mode can be switched between:
  - absolute value
  - change since start (absolute)
  - change since start (%)

  If any subject's values are hidden from the viewer (FR-43), only the % mode is available.
- FR-63: X-axis choice: calendar date, or **age** (if a birthdate is set), which is useful for children.
- FR-64: A time span selection: **Week**, **Month**, **Year** or **All**. If the group has a duration (FR-15), **Duration** is offered too and is the default; otherwise the default is All.
  - **Baseline for % change:** by default, each subject's first entry ever. Groups with a duration also offer **"since the group's start"**, which uses each subject's first entry on or after the start date. This makes people who joined late comparable.
- FR-65: An entry list/table that can be sorted and filtered by subject and attribute.
- FR-66: **Recent entries**: the dashboard lists the latest entries of the group, with links to the full entry table (FR-65). There are no notifications in v1.

### 4.8 Export
- FR-70: Export a group's entries as CSV. The export contains what the user sees in the app: actual values where they're visible, and % change where they're hidden (FR-43), with a column showing which one each row contains. There's no account-wide export.

### 4.9 Limits
- FR-80: To keep the app healthy, v1 enforces these limits:

  | Item | Limit |
  |---|---|
  | Group, subject and attribute names | 80 characters |
  | Group descriptions | 500 characters |
  | Comments | 500 characters |
  | Groups per user | 50 |
  | Members per group | 50 |
  | Attributes per group | 100 |

---

## 5. Permissions

| Action | Owner | Editor | Viewer |
|---|:-:|:-:|:-:|
| View group, subjects, entries, charts | ✅ | ✅ | ✅ |
| Add/edit/delete entries for **own linked subject** | ✅ | ✅ | ✅ |
| Add/edit/delete entries for **any subject** (only if "Members can only edit their own subject" is off) | ✅ | ✅ | ❌ |
| Manage subjects | ✅ | ✅ | ❌ |
| Create, edit, reorder and archive attributes | ✅ | ✅ | ❌ |
| Delete attributes that have entries | ✅ | ❌ | ❌ |
| Choose value visibility for **own linked subject** (FR-43) | ✅ | ✅ | ✅ |
| Choose value visibility for a **subject without an account** | if they can log for it | if they can log for it | ❌ |
| See or change **other members'** hidden values or settings | ❌ | ❌ | ❌ |
| Edit group name, description, duration | ✅ | ✅ | ❌ |
| Invite members (as editor or viewer) | ✅ | ✅ | ❌ |
| Approve requests to link to an existing subject (FR-22) | ✅ | ❌ | ❌ |
| Change roles / remove members / transfer ownership | ✅ | ❌ | ❌ |
| Change the group setting "Members can only edit their own subject" | ✅ | ❌ | ❌ |
| Leave the group | ❌ (transfer first) | ✅ | ✅ |
| Archive / delete group | ✅ | ❌ | ❌ |
| Export CSV | ✅ | ✅ | ✅ |

**Group setting "Members can only edit their own subject":** In the kids group, editors (parents) must be able to log for *any* subject. In the diet group, members should only edit *their own* entries. This per-group setting covers both: it's off by default for family-style groups and on for challenge-style groups. When it's on, it applies to **everyone, including the owner**: entries can only be logged and edited for your own linked subject. The owner can still manage the subjects themselves (rename, archive and so on).

**Viewers** are read-only, except for their own linked subject: a viewer who is linked to a subject can log entries for it and choose its value visibility.

---

## 6. Product Qualities

- **Privacy:** All data is private by default and visible only to group members. There are no public pages in v1. Because the app is invite-only, a short privacy note is shown instead of a full privacy policy.
- **Mobile-first:** Logging a measurement on a phone should take only a few taps.
- **Long-term use:** The app stays quick to use with many years of data per subject.
- **Data ownership:** Users can export their groups' data (FR-70), can take their data out of a group when leaving (FR-23), and deleting an account removes the user's personal data (FR-3).
- **Accessibility:** Best effort, following good practice (contrast, keyboard use, labels, information never shown by colour alone). There's no formal WCAG target.
- **Browsers:** The last two versions of Chrome, Edge, Firefox and Safari, including iOS Safari and Android Chrome.
- **Language & formats:** The UI is in English only. Dates and numbers are formatted according to the viewer's browser settings (e.g. `03.11.2026` and `72.5`, or `11/3/2026`).

---

## 7. Out of Scope for v1 / Future Ideas

- Goals/targets per subject and attribute (e.g. "target weight 75 kg by June"), with progress bars
- Reminders ("log your weight every Monday")
- Notifications (e.g. someone joined or logged an entry)
- Metric/imperial unit conversion
- Growth-percentile reference curves for children (WHO/CDC)
- Derived attributes (e.g. BMI from height and weight)
- Non-numeric attribute types (text, boolean, rating)
- Photos attached to entries
- Leaderboards
- Read-only public share links
- Comments or reactions on other people's entries
- Logging while offline
- Importing existing data (e.g. from spreadsheets)
- Account-wide data export
- More UI languages (e.g. German)
- Undo or a bin for deleted entries, and edit history

---

## 8. Open Questions

None at the moment.

---

## 9. Decision Log

| Date | Decision | Where |
|---|---|---|
| 2026-11-03 | Value visibility is chosen per subject and attribute by the subject itself (or, for subjects without an account, by those who can log for them). The owner can't change it. Default: actual values. | FR-43, §5 |
| 2026-11-03 | Linking a joiner to an existing subject needs the owner's approval. | FR-22 |
| 2026-11-03 | A leaving member chooses whether their entries stay or are deleted; removed members' entries stay. Kept subjects keep their visibility settings, which can't be changed afterwards. | FR-23 |
| 2026-11-03 | CSV export stays per group; no account-wide export. | FR-70 |
| 2026-11-03 | No Google sign-in: email and password only, to avoid reconciling a Google identity with the invited account. | FR-1 |
| 2026-11-03 | The UI is in English only, with no translation setup. Dates and numbers follow the viewer's browser settings. | §6 |
| 2026-11-03 | The owner can't leave without transferring ownership first. | FR-23 |
| 2026-11-03 | Owners and editors manage attributes; only the owner deletes attributes that have entries. | FR-40, FR-42 |
| 2026-11-03 | Account deletion is blocked while the user owns groups other than their default group. | FR-3 |
| 2026-11-03 | Archived subjects and attributes are read-only. | FR-32, FR-42 |
| 2026-11-03 | Unit and precision changes are allowed with a warning. | FR-41 |
| 2026-11-03 | Any number is allowed as a value; % shows "n/a" when the baseline is 0. | FR-43, FR-50 |
| 2026-11-03 | Min/max limits only apply to new or edited entries. | FR-40 |
| 2026-11-03 | Viewers can log for, and set the visibility of, their own linked subject. | §5 |
| 2026-11-03 | Times are shown in the viewer's local time zone. | FR-50 |
| 2026-11-03 | % baseline: each subject's first entry; groups with a duration also offer "since the group's start". | FR-64 |
| 2026-11-03 | The group list is the first page after logging in. | FR-12 |
| 2026-11-03 | The default group offers suggested attributes. | FR-13 |
| 2026-11-03 | A linked subject's name follows the display name until renamed in the group. | FR-33 |
| 2026-11-03 | Profile: display name, email and password can be changed. | FR-2 |
| 2026-11-03 | Deleting entries is permanent; no undo, no edit history. | FR-50, FR-52 |
| 2026-11-03 | The dashboard shows recent entries; no notifications. | FR-66 |
| 2026-11-03 | Usage limits for text lengths, groups, members and attributes. | FR-80 |
| 2026-11-03 | Invite-only: accounts are only created through invites or by the operator. | FR-1, FR-20 |
| 2026-11-03 | Email in v1: invites by email and password reset. No email confirmation, because there's no public sign-up. | FR-1, FR-20 |
| 2026-11-03 | Accessibility: best effort. Browsers: current evergreen. | §6 |
| 2026-11-06 | Email changes are confirmed by a link to the new address; the old address is notified afterwards. Password changes need the current password and send a notice. | FR-2 |
| 2026-11-06 | Passwords have at least 8 characters. Password reset links work once and expire after an hour. | FR-1 |
| 2026-11-09 | Every subject has a colour from a fixed palette of eight, suggested automatically (the one least used in the group) and changeable. Its avatar shows its initials in that colour; there are no uploaded pictures in v1. | FR-30 |
| 2026-11-09 | Renaming a linked subject back to the user's display name makes it follow the display name again. | FR-33 |
| 2026-11-09 | Subjects are called "participants" in the app (text and URLs), since "subject" would confuse users. The spec, database and code keep "subject". | Glossary |
| 2026-11-09 | Units are free text per attribute (up to 20 characters), with common units suggested in the form. No structured units or conversion in v1. | FR-40, §8 |
| 2026-11-09 | Attributes are called "metrics" in the app (text and URLs). The spec, database and code keep "attribute". | Glossary |
| 2026-11-09 | Attribute names are unique within a group, ignoring case (archived ones included). Suggested attributes are offered in any group without attributes, not only the default group. | FR-13, FR-40 |
| 2026-11-09 | The group page leads with charts (one per attribute, all subjects); recent entries come after them and are secondary. | FR-60 |
| 2026-11-09 | Charts group by attribute, never by subject: every line in a chart shares one unit and scale. A filter narrows the charts to some subjects. There's no chart combining one subject's different attributes, since their units differ. *(Revised the same day, see below.)* | FR-60, FR-61 |
| 2026-11-09 | Revised: the group page has two chart views, by attribute (real values, subjects filterable) and by subject (all attributes as % change since their first entry, attributes filterable). Using % change lets different units share one chart honestly. | FR-60 |
| 2026-11-09 | The app tracks without judging: attributes have no "higher/lower is better" direction, and changes aren't coloured as good or bad. | FR-40, FR-60 |
| 2026-11-09 | A group's management pages (participants, metrics, editing the group, later members) sit behind one "Options" menu on the group page. | FR-11 |
| 2026-11-09 | Groups are called "logbooks" in the app (text and URLs, e.g. `/logbooks/…`), as a more intuitive name for a shared or personal measurement record. The spec, database and code keep "group". | Glossary |
