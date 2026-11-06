import { readFileSync } from 'node:fs'

import { createClient } from '@supabase/supabase-js'

// Seeded demo accounts (supabase/seed.sql). Local only.
export const SEED_PASSWORD = 'password'
export const users = {
  alex: { email: 'alex@example.com', displayName: 'Alex Example' },
  kim: { email: 'kim@example.com', displayName: 'Kim Example' },
}

export const MAILPIT_URL = 'http://127.0.0.1:54324'

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
