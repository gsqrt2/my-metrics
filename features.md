# my-metrics: Core Features

A product-level overview of the features described in [spec.md](spec.md) (v0.2). Requirement numbers (FR-…) point to the spec for details.

**Contents**

1. [Accounts](#1-accounts): invite-only sign-in, profile, account deletion
2. [Groups](#2-groups): group list, default group, creating and editing groups, duration, archiving and deleting
3. [Sharing & Membership](#3-sharing--membership): invitations, joining, managing members, leaving
4. [Tracking Setup](#4-tracking-setup): subjects, attributes, value visibility, the "own subject only" setting
5. [Logging](#5-logging): logging entries, editing and deleting entries
6. [Insights](#6-insights): dashboard, subject view, full-screen chart, comparison, entry table
7. [Export](#7-export): CSV export

---

## 1. Accounts

### Invite-only sign-in (FR-1)
**Description:** Accounts can only be created by accepting an invite to a group; there's no public sign-up. Members log in with email and password, and can reset a forgotten password by email.

**User flow**
1. The person receives an invite link, either shared directly or by email.
2. If they don't have an account yet, accepting the invite creates one.
3. Later, they log in with their email and password.
4. If they forget their password, they request a reset and follow the link in the email.
5. They can log out at any time.

**UI overview**
- A login screen with an email/password form.
- A "Forgot password" option that sends a reset email.
- No sign-up option; new accounts start from an invite.

### Profile (FR-2)
**Description:** Users manage their own display name, email address and password.

**User flow**
1. The user opens their profile.
2. They change their display name, email address or password and save.
3. A new display name also appears on their linked subjects, unless a subject was renamed in its group (FR-33).

**UI overview**
- A profile page with fields for display name, email and password.

### Account deletion (FR-3)
**Description:** Users can delete their account and their personal data. Deletion is only possible once they no longer own any group other than their default group.

**User flow**
1. The user chooses to delete their account.
2. If they still own other groups, they're asked to transfer ownership or delete those groups first.
3. They confirm the deletion.
4. Their default group and their own linked subjects with all entries are deleted. Entries they logged for others stay, without their name.

**UI overview**
- A "Delete account" option in the profile.
- A list of owned groups that block deletion, with ways to resolve each.
- A confirmation step.

---

## 2. Groups

### Group list (FR-12)
**Description:** An overview of every group the user belongs to. It's the first page after logging in.

**User flow**
1. The user logs in and lands on the group list.
2. They select a group to open its dashboard, or create a new group.

**UI overview**
- A list of the user's groups.
- An option to create a group.

### Default group (FR-13)
**Description:** Every new account comes with a private group called "Personal", with the user as its owner and only subject, so they can start tracking right away.

**User flow**
1. A new user opens their default group.
2. Since it has no attributes yet, they pick from suggested attributes (e.g. Weight, Height, Waist) or create a custom one.
3. They start logging.
4. Later they can rename or share it. It can't be deleted, left or transferred.

**UI overview**
- An empty state with suggested attributes and a "Custom" option.

### Create and edit a group (FR-10, FR-11, FR-14)
**Description:** Users create groups for different contexts, such as "Kids", "Performance" or a diet challenge. The group gives its attributes their meaning. Groups are private until someone is invited.

**User flow**
1. The user creates a group with a name, and optionally a description and a duration.
2. They become the group's owner.
3. Later, the owner or an editor changes the name, description or duration.

**UI overview**
- A create/edit form with name, description and an optional duration.

### Group duration (FR-15)
**Description:** A group can optionally have a start and end date, e.g. for a 12-week challenge. The duration shows progress and sets the charts' default time span.

**User flow**
1. The owner or an editor sets a start and end date for the group.
2. Members see how far along the group is on its dashboard.
3. Entries can still be logged outside the dates, e.g. a baseline before the start.
4. When the end date passes, the group stays usable until the owner archives it.

**UI overview**
- Start and end date fields in the group's settings.
- A progress indicator on the dashboard, e.g. "Day 64 of 84 · 20 days left" or "Ended".

### Archive and delete a group (FR-11)
**Description:** The owner can archive a group, making it read-only, or delete it.

**User flow**
1. The owner chooses to archive or delete the group.
2. An archived group stays visible but can't be changed.
3. A deleted group is removed for all members.

**UI overview**
- Archive and delete options available only to the owner.

---

## 3. Sharing & Membership

### Invitations (FR-20, FR-21)
**Description:** Owners and editors invite people to a group as editors or viewers, either with a shareable link or by email.

**User flow**
1. An owner or editor chooses to invite someone and picks a role: editor or viewer.
2. They either create a shareable link (which expires and can be revoked) and send it through any channel, or enter an email address so the app sends a single-use link.
3. They can revoke invites they created. The owner can revoke any invite.

**UI overview**
- An invite option in the group with a role choice.
- A shareable link to copy, or an email address field.
- A list of open invites with a revoke option.

### Joining a group (FR-22)
**Description:** When someone accepts an invite, they decide how they appear in the group: as a new subject, linked to an existing subject without an account, or without a subject.

**User flow**
1. The invitee opens the invite and, if needed, gets an account (FR-1).
2. They choose one of:
   - create a new subject for themselves (the default)
   - request to be linked to an existing subject without an account
   - no subject, e.g. to only watch
3. A link request waits until the owner approves or rejects it.

**UI overview**
- A join step with the three options.
- For the owner: pending link requests with approve and reject actions.

### Managing members (FR-23, FR-24)
**Description:** The owner manages who is in the group and what they can do. Ownership can be handed to another member.

**User flow**
1. The owner opens the member list.
2. They change a member's role, remove a member, or transfer ownership.
3. When a member is removed, their entries stay in the group, and their subject keeps its visibility settings, which can no longer be changed.

**UI overview**
- A member list with roles.
- Owner-only actions to change roles, remove members and transfer ownership.

### Leaving a group (FR-23)
**Description:** Members can leave a group and decide what happens to their data. The owner must transfer ownership before leaving.

**User flow**
1. The member chooses to leave the group.
2. They're offered a CSV export first.
3. They choose whether their entries stay in the group or are deleted.
4. If they stay, the subject is no longer linked to them and its visibility settings are locked.

**UI overview**
- A "Leave group" option for editors and viewers.
- A step offering the export and the keep/delete choice.
- For the owner, a note to transfer ownership first.

---

## 4. Tracking Setup

### Subjects (FR-30 – FR-33)
**Description:** Subjects are who is being measured in a group. A subject can be a member tracking themselves, or someone without an account, such as a child.

**User flow**
1. An owner or editor adds a subject with a name, and optionally a birthdate and a colour or avatar.
2. They edit or archive subjects as needed.
3. Archived subjects are hidden by default and can't get new entries until restored.

**UI overview**
- A list of the group's subjects with add, edit and archive options.
- A subject form with name, optional birthdate and optional colour or avatar.

### Attributes (FR-40 – FR-42)
**Description:** Attributes are the custom-named metrics a group tracks, such as Height in cm or Waist in cm. Each attribute exists only within its group.

**User flow**
1. An owner or editor creates an attribute with:
   - a name, and optionally a unit
   - the number of decimals
   - a direction: higher is better, lower is better, or neutral
   - optional min/max limits
2. They rename, reorder or archive attributes.
3. Changing the unit or decimals of an attribute that has entries shows a warning first.
4. Only the owner can delete an attribute that has entries, after confirming.

**UI overview**
- A list of the group's attributes with create, edit, reorder and archive options.
- An attribute form with the fields above.
- A warning when changing the unit or decimals, and a confirmation when deleting.

### Value visibility (FR-43)
**Description:** For each attribute, each person decides whether other members see their actual values or only their % change. Nobody else can change this choice or see past it, not even the owner.

**User flow**
1. A member opens an attribute of their own subject and switches between "actual values" and "% only". Actual values is the default.
2. For a subject without an account, the members who can log for it make this choice.
3. With "% only", other members see only the % change since the starting point. The person themselves still sees actual values and can view % too.
4. Switching back to actual values shows all past entries again.

**UI overview**
- An "actual values / % only" switch per attribute on your own subject.
- For other members, hidden values appear as % change, marked as % only.

### "Members can only edit their own subject" setting (§5)
**Description:** A group setting that limits logging to each member's own subject. It's useful for challenges, where everyone tracks themselves.

**User flow**
1. The owner turns the setting on or off.
2. While it's on, everyone, including the owner, can only log and edit entries for their own subject.

**UI overview**
- An owner-only switch in the group's settings.

---

## 5. Logging

### Log entries / quick entry (FR-50, FR-51, FR-53, FR-54)
**Description:** Members record measurements with a date and time and an optional comment. Quick entry logs several attributes for one subject at once.

**User flow**
1. The member starts a new entry.
2. They pick the subject, if they can log for more than one.
3. They keep the date and time (which defaults to now) or change it to a past one to back-fill.
4. They enter values for one or more attributes and optionally add a comment, which is shared by all values.
5. They save. Future times, values outside an attribute's limits, and a second entry for the same attribute at the exact same time are rejected.

**UI overview**
- A quick-entry form with:
  - subject
  - date and time
  - a value field for each attribute
  - one comment field
- Times are shown in the viewer's local time zone.

### Edit and delete entries (FR-52)
**Description:** Entries can be corrected or removed by members who are allowed to log for that subject.

**User flow**
1. The member selects an entry.
2. They change its value, date and time or comment and save, or delete it.
3. Deleting asks for confirmation and can't be undone.

**UI overview**
- Edit and delete actions on an entry.
- A confirmation before deleting.
- Each entry shows who created it and who last changed it.

---

## 6. Insights

### Group dashboard (FR-60, FR-66)
**Description:** The group's home page. It shows the latest value of every subject and attribute, how it has changed, and the most recent entries.

**User flow**
1. The member opens a group.
2. They scan the latest values and the change since the previous entry and since the first entry.
3. They look at recent entries, or move on to a subject, a chart, the comparison or the full entry table.

**UI overview**
- For each subject: the latest value per attribute, the change since the previous entry and since the first entry, coloured by whether it's improving.
- Hidden values (FR-43) shown as % change.
- A list of recent entries.
- The group's progress if it has a duration.

### Subject view and full-screen chart (FR-61, FR-63, FR-64)
**Description:** A subject's history as a line chart per attribute with a table of entries. Any chart can be opened full screen for a closer look.

**User flow**
1. The member opens a subject, or selects an attribute's chart on the dashboard.
2. They select points on the chart to see comments.
3. They open a chart full screen.
4. They choose a time span:
   - Week, Month, Year or All
   - Duration, if the group has one; it's then the default
5. For subjects with a birthdate, they switch the x-axis between date and age.

**UI overview**
- A line chart per attribute and a table of entries with comments.
- In full screen:
  - the time span choice and the date/age choice
  - the latest value and the change within the selected span
  - a table of the entries in that span

### Comparison view (FR-62, FR-64)
**Description:** One attribute with every subject's line on the same chart, to compare progress between people.

**User flow**
1. The member picks an attribute to compare.
2. They switch between absolute values, change since start, and % change since start.
3. Groups with a duration can measure % "since the group's start", so people who joined late are comparable.

**UI overview**
- A chart with one line per subject.
- A switch for the display mode.
- A choice of starting point for groups with a duration.
- Only % change is offered if any of the values are hidden from the viewer.

### Entry table (FR-65)
**Description:** All of a group's entries in one list, for finding and reviewing specific measurements.

**User flow**
1. The member opens the full entry table.
2. They filter by subject and attribute, and sort the list.

**UI overview**
- A table with filters and sorting.

---

## 7. Export

### CSV export (FR-70)
**Description:** Members download a group's entries as a CSV file. It contains exactly what they can see in the app.

**User flow**
1. The member chooses to export the group's data.
2. They receive a CSV file with actual values where visible and % change where hidden, with a column showing which one each row contains.

**UI overview**
- An export option in the group, available to every role.
