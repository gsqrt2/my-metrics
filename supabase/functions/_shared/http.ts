// What every Edge Function here shares: answering the browser (CORS, JSON),
// reading the request, and the Supabase clients they work with. Folders
// starting with "_" aren't deployed as functions themselves.
import {
  createClient,
  type SupabaseClient,
} from 'npm:@supabase/supabase-js@2.119.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// A JSON answer: the result, or { error: <code> } for the app to explain.
export function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Serves a function that takes a JSON body by POST. The browser's CORS
// check, other methods and unreadable bodies are answered here.
export function serveJson(
  handler: (body: unknown, request: Request) => Promise<Response>,
) {
  Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }
    if (request.method !== 'POST') {
      return reply(405, { error: 'method_not_allowed' })
    }
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return reply(400, { error: 'invalid_input' })
    }
    return handler(body, request)
  })
}

const noSession = { persistSession: false, autoRefreshToken: false }
const url = () => Deno.env.get('SUPABASE_URL')!

// Bypasses the database's rules: only for what a function must do itself
// (creating or deleting accounts, cleaning up after a failure).
export function adminClient(): SupabaseClient {
  return createClient(url(), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: noSession,
  })
}

// Acts as the caller (their Authorization header) or, without one, as a
// visitor who can sign in: the database's rules apply as in the app.
export function userClient(authorization?: string): SupabaseClient {
  return createClient(url(), Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: noSession,
    global: authorization
      ? { headers: { Authorization: authorization } }
      : undefined,
  })
}

export const isEmail = (text: string) =>
  text.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)
