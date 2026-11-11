// Deletes the signed-in user's account (spec FR-3; plan step 15).
//
// Deleting a user needs the admin API, so it happens here. Steps:
//   1. who's asking (their token), and their current password, so a session
//      left open on someone else's device isn't enough
//   2. not while they own groups other than their default group: those must
//      be transferred or deleted first (the database refuses it too)
//   3. delete the auth user; the foreign keys remove the profile, the
//      default group, memberships and linked subjects with their entries, and
//      clear the user's name on entries logged for others
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const noSession = { persistSession: false, autoRefreshToken: false }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST')
    return reply(405, { error: 'method_not_allowed' })

  let password = ''
  try {
    const body = await request.json()
    if (typeof body?.password === 'string') password = body.password
  } catch {
    return reply(400, { error: 'invalid_input' })
  }
  if (!password) return reply(400, { error: 'wrong_password' })

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: noSession,
  })

  // 1. The user, and their password.
  const token = (request.headers.get('Authorization') ?? '').replace(
    /^Bearer\s+/i,
    '',
  )
  const { data: me, error: meError } = await admin.auth.getUser(token)
  if (meError || !me.user?.email) return reply(401, { error: 'not_signed_in' })
  const user = me.user

  const check = createClient(url, anonKey, { auth: noSession })
  const signIn = await check.auth.signInWithPassword({
    email: user.email!,
    password,
  })
  if (signIn.error || signIn.data.user?.id !== user.id) {
    return reply(400, { error: 'wrong_password' })
  }
  // That check made a session; it isn't needed.
  await check.auth.signOut({ scope: 'local' })

  // 2. Groups the user owns, other than the default group.
  const owned = await admin
    .from('memberships')
    .select('group:groups!inner(id, name, default_for_user_id)')
    .eq('user_id', user.id)
    .eq('role', 'owner')
  if (owned.error) return reply(500, { error: 'delete_failed' })
  const blocking = (
    owned.data as unknown as {
      group: { id: string; name: string; default_for_user_id: string | null }
    }[]
  )
    .map((row) => row.group)
    .filter((group) => group.default_for_user_id !== user.id)
  if (blocking.length > 0) {
    return reply(409, {
      error: 'owns_groups',
      groups: blocking.map(({ id, name }) => ({ id, name })),
    })
  }

  // 3. The account, and with it everything that's the user's.
  const deleted = await admin.auth.admin.deleteUser(user.id)
  if (deleted.error) {
    console.error('delete-account: deleting failed', deleted.error)
    return reply(500, { error: 'delete_failed' })
  }
  return reply(200, { deleted: true })
})
