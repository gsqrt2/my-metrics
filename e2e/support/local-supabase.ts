import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

// Seeded demo accounts (supabase/seed.sql). Local only.
export const SEED_PASSWORD = 'password'
// Tests that change an account each use their own, so they can run in parallel.
export const users = {
  alex: { email: 'alex@example.com', displayName: 'Alex Example' }, // read-only
  sam: { email: 'sam@example.com', displayName: 'Sam Example' }, // display name
  kim: { email: 'kim@example.com', displayName: 'Kim Example' }, // password reset
  lee: { email: 'lee@example.com', displayName: 'Lee Example' }, // email change
  robin: { email: 'robin@example.com', displayName: 'Robin Example' }, // password change
  // Log in and out. Logging out ends all of an account's sessions, so each
  // device size gets its own account.
  pat: { email: 'pat@example.com', displayName: 'Pat Example' }, // desktop
  max: { email: 'max@example.com', displayName: 'Max Example' }, // phone
  jo: { email: 'jo@example.com', displayName: 'Jo Example' }, // creates groups
  ari: { email: 'ari@example.com', displayName: 'Ari Example' }, // subjects
  noa: { email: 'noa@example.com', displayName: 'Noa Example' }, // attributes
  eli: { email: 'eli@example.com', displayName: 'Eli Example' }, // entries
  tom: { email: 'tom@example.com', displayName: 'Tom Example' }, // invites (owner)
  uma: { email: 'uma@example.com', displayName: 'Uma Example' }, // invites (joins)
  val: { email: 'val@example.com', displayName: 'Val Example' }, // members (owner)
  wes: { email: 'wes@example.com', displayName: 'Wes Example' }, // members (member)
  yan: { email: 'yan@example.com', displayName: 'Yan Example' }, // privacy
  zoe: { email: 'zoe@example.com', displayName: 'Zoe Example' }, // archive, delete
}

export const MAILPIT_URL = 'http://127.0.0.1:54324'
// The local database, for cleaning up what the app itself can't delete yet.
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

// Same values the app reads (see README: .env.local).
function readEnvLocal() {
  const env: Record<string, string> = {}
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/)
    if (match) env[match[1]] = match[2]
  }
  return env
}

function supabaseClient() {
  const env = readEnvLocal()
  return createClient(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  )
}

// Sets an account's password back to the seed password, so tests that change
// it can be re-run.
export async function restoreSeedPassword(email: string, current: string) {
  const supabase = supabaseClient()
  const signIn = await supabase.auth.signInWithPassword({
    email,
    password: current,
  })
  if (signIn.error) throw signIn.error
  const update = await supabase.auth.updateUser({ password: SEED_PASSWORD })
  if (update.error) throw update.error
}

function searchUrl(email: string) {
  return `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`
}

export async function clearMailbox(email: string) {
  await fetch(searchUrl(email), { method: 'DELETE' })
}

// Waits for the newest email to `email` and returns its plain-text body.
export async function latestEmailText(email: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const search = await fetch(searchUrl(email))
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    if (messages.length > 0) {
      const message = await fetch(
        `${MAILPIT_URL}/api/v1/message/${messages[0].ID}`,
      )
      const { Text } = (await message.json()) as { Text: string }
      return Text
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`No email to ${email} arrived within ${timeoutMs} ms`)
}

// Deletes the groups an account owns, except its default group, so tests that
// create groups can be re-run without reaching the limit of 50 (FR-80).
// Replace with deleting through the app once it can (plan step 14).
export async function deleteOwnedGroups(email: string) {
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()
  try {
    await client.query(
      `delete from public.groups g
       using public.memberships m, auth.users u
       where m.group_id = g.id and m.user_id = u.id and m.role = 'owner'
         and u.email = $1 and g.default_for_user_id is null`,
      [email],
    )
  } finally {
    await client.end()
  }
}

// Empties an account's default group of the attributes (and so the entries)
// a test added, since the default group itself can't be deleted (FR-13).
export async function clearDefaultGroup(email: string) {
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()
  try {
    await client.query(
      `delete from public.attributes a
       using public.groups g, auth.users u
       where a.group_id = g.id and g.default_for_user_id = u.id and u.email = $1`,
      [email],
    )
  } finally {
    await client.end()
  }
}

// Deletes accounts that tests created by joining (FR-1), by email pattern
// (SQL "like"), with their profiles, memberships and subjects.
export async function deleteAccounts(emailLike: string) {
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()
  try {
    await client.query('delete from auth.users where email like $1', [
      emailLike,
    ])
  } finally {
    await client.end()
  }
}

// Adds an account to a group as a member with a linked subject (as joining
// with "Track myself here" does), straight in the database, for tests about
// members that don't need to go through an invite.
export async function addMember(
  groupUrl: string,
  email: string,
  role: 'editor' | 'viewer' | null,
) {
  const groupId = groupUrl.match(/[0-9a-f-]{36}$/)![0]
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()
  try {
    // role null: already a member (e.g. the owner), only add the subject.
    if (role) {
      await client.query(
        `insert into public.memberships (group_id, user_id, role)
         select $1, id, $3 from auth.users where email = $2`,
        [groupId, email, role],
      )
    }
    await client.query(
      `insert into public.subjects (group_id, name, linked_user_id)
       select $1, p.display_name, p.id
       from public.profiles p join auth.users u on u.id = p.id where u.email = $2`,
      [groupId, email],
    )
  } finally {
    await client.end()
  }
}
