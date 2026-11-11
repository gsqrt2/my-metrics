// Invites someone by email (spec FR-20; plan step 13): creates a single-use
// invite bound to the address, as the signed-in member, and mails the link.
//
// The invite is created with the caller's own token, so the database decides
// as for any invite: owners and editors only, not for existing members, at
// most 20 email invites a day (check_email_invite). If the mail can't be
// sent, the invite is deleted again.
//
// Mail goes out over SMTP: Mailpit locally (supabase/config.toml,
// [edge_runtime.secrets]), the provider set with `supabase secrets set` in
// the cloud. Supabase blocks outgoing ports 25 and 587, so the cloud uses 465
// (TLS from the start).
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'

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
  groupId: string
  email: string
  role: 'editor' | 'viewer'
  days: 1 | 7 | 30
}

function readInput(body: unknown): Input | string {
  if (typeof body !== 'object' || body === null) return 'invalid_input'
  const b = body as Record<string, unknown>
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : ''
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'invalid_email'
  }
  if (typeof b.groupId !== 'string') return 'invalid_input'
  if (b.role !== 'editor' && b.role !== 'viewer') return 'invalid_input'
  if (b.days !== 1 && b.days !== 7 && b.days !== 30) return 'invalid_input'
  return { groupId: b.groupId, email, role: b.role, days: b.days }
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  )

function message(input: {
  inviter: string
  group: string
  role: Input['role']
  days: Input['days']
  link: string
}) {
  const role = input.role === 'editor' ? 'an editor' : 'a viewer'
  const days = input.days === 1 ? '1 day' : `${input.days} days`
  const subject = `${input.inviter} invited you to ${input.group} on my-metrics`
  const text = [
    `${input.inviter} invited you to join the logbook “${input.group}” on my-metrics as ${role}.`,
    '',
    `Open this link to join: ${input.link}`,
    '',
    `The link works once, only with this email address, for ${days}.`,
    "If you weren't expecting this, you can ignore this email.",
  ].join('\n')
  const html = `<p>${escapeHtml(input.inviter)} invited you to join the logbook “${escapeHtml(input.group)}” on my-metrics as ${role}.</p>
<p><a href="${escapeHtml(input.link)}">Join ${escapeHtml(input.group)}</a></p>
<p>The link works once, only with this email address, for ${days}.<br>
If you weren't expecting this, you can ignore this email.</p>`
  return { subject, text, html }
}

async function sendMail(to: string, mail: ReturnType<typeof message>) {
  const port = Number(Deno.env.get('SMTP_PORT') ?? '465')
  const user = Deno.env.get('SMTP_USER')
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get('SMTP_HOST')!,
      port,
      tls: port === 465,
      auth: user
        ? { username: user, password: Deno.env.get('SMTP_PASS') ?? '' }
        : undefined,
    },
    // Local Mailpit speaks plain SMTP; nowhere else is that allowed.
    debug:
      Deno.env.get('SMTP_INSECURE') === 'true'
        ? { allowUnsecure: true, noStartTLS: true }
        : undefined,
  })
  try {
    await client.send({
      from: Deno.env.get('MAIL_FROM')!,
      to,
      subject: mail.subject,
      content: mail.text,
      html: mail.html,
    })
  } finally {
    // Closing fails if connecting already did; that error is the one to see.
    try {
      await client.close()
    } catch {
      // ignored
    }
  }
}

const knownErrors: Record<string, [number, string]> = {
  already_member: [409, 'already_member'],
  email_invite_limit: [429, 'email_invite_limit'],
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST')
    return reply(405, { error: 'method_not_allowed' })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return reply(400, { error: 'invalid_input' })
  }
  const input = readInput(body)
  if (typeof input === 'string') return reply(400, { error: input })

  const url = Deno.env.get('SUPABASE_URL')!
  const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: request.headers.get('Authorization') ?? '' },
    },
  })

  // The invite, as the caller: the database checks who may invite whom.
  const expires = new Date(Date.now() + input.days * 24 * 3600 * 1000)
  const inserted = await asUser
    .from('invites')
    .insert({
      group_id: input.groupId,
      role: input.role,
      email: input.email,
      expires_at: expires.toISOString(),
    })
    .select('id, token, created_by')
    .single()
  if (inserted.error) {
    const known = knownErrors[inserted.error.message]
    if (known) return reply(known[0], { error: known[1] })
    if (inserted.error.code === '42501') {
      return reply(403, { error: 'not_allowed' })
    }
    return reply(500, { error: 'invite_failed' })
  }
  const invite = inserted.data

  const [group, inviter] = await Promise.all([
    asUser.from('groups').select('name').eq('id', input.groupId).single(),
    asUser
      .from('profiles')
      .select('display_name')
      .eq('id', invite.created_by)
      .single(),
  ])
  const link = `${Deno.env.get('APP_URL')}/join/${invite.token}`
  try {
    await sendMail(
      input.email,
      message({
        inviter: inviter.data?.display_name ?? 'Someone',
        group: group.data?.name ?? 'a logbook',
        role: input.role,
        days: input.days,
        link,
      }),
    )
  } catch (error) {
    console.error('send-invite: mail failed', error)
    const admin = createClient(
      url,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await admin.from('invites').delete().eq('id', invite.id)
    return reply(502, { error: 'send_failed' })
  }

  return reply(200, { inviteId: invite.id })
})
