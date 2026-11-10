// Creates an account for someone accepting an invite, and joins them to the
// invite's group (spec FR-1, FR-20 – FR-22; tech.md §3).
//
// Sign-ups are off in Supabase Auth, so this is the only way new accounts
// are made (besides the operator). It's public: the invite token is the
// permission. Steps:
//   1. check the input and that the invite is valid
//   2. create the user with the admin API, email marked as confirmed
//   3. sign in as them and call accept_invite, like any member joining
//   4. if joining fails, delete the user again, so no account is left
//      without its group
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'

const MIN_PASSWORD_LENGTH = 8 // supabase/config.toml, spec FR-1
const MAX_NAME_LENGTH = 80 // spec FR-80

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

type Input = {
  token: string
  email: string
  password: string
  displayName: string
  choice: 'new' | 'request' | 'none'
  subjectId: string | null
}

function readInput(body: unknown): Input | string {
  if (typeof body !== 'object' || body === null) return 'invalid_input'
  const b = body as Record<string, unknown>
  const text = (key: string) => (typeof b[key] === 'string' ? (b[key] as string) : '')
  const input: Input = {
    token: text('token'),
    email: text('email').trim(),
    password: text('password'),
    displayName: text('displayName').trim(),
    choice: text('choice') as Input['choice'],
    subjectId: typeof b.subjectId === 'string' ? b.subjectId : null,
  }
  if (!input.token) return 'invite_invalid'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return 'invalid_email'
  if (input.password.length < MIN_PASSWORD_LENGTH) return 'weak_password'
  if (!input.displayName || input.displayName.length > MAX_NAME_LENGTH) {
    return 'invalid_display_name'
  }
  if (!['new', 'request', 'none'].includes(input.choice)) return 'invalid_choice'
  return input
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return reply(400, { error: 'invalid_input' })
  }
  const input = readInput(body)
  if (typeof input === 'string') return reply(400, { error: input })

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. The invite must be valid (and, for email invites, for this address).
  const preview = await admin.rpc('get_invite_preview', { invite_token: input.token })
  const invite = preview.data?.[0]
  if (preview.error || !invite || invite.status !== 'valid') {
    return reply(400, { error: 'invite_invalid' })
  }
  if (invite.invite_email && invite.invite_email.toLowerCase() !== input.email.toLowerCase()) {
    return reply(400, { error: 'invite_for_other_email' })
  }

  // 2. The account. Receiving the invite counts as proof of the address.
  const created = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { display_name: input.displayName },
  })
  if (created.error || !created.data.user) {
    const taken =
      created.error?.code === 'email_exists' || /already/i.test(created.error?.message ?? '')
    return reply(taken ? 409 : 500, { error: taken ? 'email_taken' : 'account_failed' })
  }
  const userId = created.data.user.id

  // 3. Join as the new user, through the same function as everyone else.
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signIn = await asUser.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })
  const joined = signIn.error
    ? { error: signIn.error, data: null }
    : await asUser.rpc('accept_invite', {
        invite_token: input.token,
        choice: input.choice,
        request_subject_id: input.subjectId ?? undefined,
      })

  // 4. No account without its group.
  if (joined.error) {
    await admin.auth.admin.deleteUser(userId)
    const known = ['invite_invalid', 'subject_unavailable', 'member_limit_reached']
    const code = known.includes(joined.error.message) ? joined.error.message : 'join_failed'
    return reply(400, { error: code })
  }

  return reply(200, { groupId: joined.data })
})
