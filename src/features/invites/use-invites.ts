import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/use-auth'
import { groupKeys } from '@/features/groups/use-groups'
import { supabase } from '@/lib/supabase'
import type { Enums, Tables } from '@/types/database'

export type InviteRole = 'editor' | 'viewer'

export type Invite = Pick<
  Tables<'invites'>,
  'id' | 'token' | 'role' | 'email' | 'expires_at' | 'revoked_at' | 'created_by'
> & { creator: { display_name: string } | null }

export type LinkRequest = Pick<
  Tables<'subject_link_requests'>,
  'id' | 'subject_id' | 'user_id' | 'created_at'
> & {
  subject: { name: string }
  requester: { display_name: string }
}

export type InvitePreview = {
  status: 'valid' | 'invalid' | 'expired' | 'revoked' | 'used'
  group_id: string | null
  group_name: string | null
  inviter_name: string | null
  role: Enums<'group_role'> | null
  // Email invites only work for this address (FR-20).
  invite_email: string | null
  expires_at: string | null
  already_member: boolean
  subjects: { id: string; name: string }[]
}

export const inviteKeys = {
  list: (groupId: string) => ['invites', groupId] as const,
  requests: (groupId: string) => ['link-requests', groupId] as const,
  preview: (token: string, userId: string | undefined) =>
    ['invite-preview', token, userId ?? null] as const,
}

// The link someone opens to join (FR-20).
export function inviteLink(token: string) {
  return `${window.location.origin}/join/${token}`
}

// A group's open invites: not revoked, expired or used (email invites are
// used once). Owners see all; editors the ones they made (RLS).
export function useOpenInvites(groupId: string) {
  return useQuery({
    queryKey: inviteKeys.list(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invites')
        .select(
          'id, token, role, email, expires_at, revoked_at, created_by, creator:profiles!invites_created_by_fkey(display_name)',
        )
        .eq('group_id', groupId)
        .is('revoked_at', null)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .overrideTypes<Invite[], { merge: false }>()
      if (error) throw error
      return data
    },
  })
}

export function useCreateInvite(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { role: InviteRole; days: number }) => {
      const expires = new Date(Date.now() + input.days * 24 * 3600 * 1000)
      const { data, error } = await supabase
        .from('invites')
        .insert({
          group_id: groupId,
          role: input.role,
          expires_at: expires.toISOString(),
        })
        .select('token')
        .single()
      if (error) throw error
      return data.token
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: inviteKeys.list(groupId) }),
  })
}

// FR-20 by email: the send-invite Edge Function makes a single-use invite for
// the address and mails the link.
export function useSendInvite(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      email: string
      role: InviteRole
      days: number
    }) => {
      const { error } = await supabase.functions.invoke('send-invite', {
        body: { groupId, ...input },
      })
      if (error) {
        // The function's own error code is in the response body.
        const body = await (error as { context?: Response }).context
          ?.json()
          .catch(() => null)
        throw new Error(body?.error ?? 'send_failed')
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: inviteKeys.list(groupId) }),
  })
}

export function sendInviteErrorMessage(error: Error) {
  switch (error.message) {
    case 'invalid_email':
      return 'Enter a valid email address.'
    case 'already_member':
      return 'Someone with this email address is already a member.'
    case 'email_invite_limit':
      return "You've sent 20 email invites today, the most allowed. Try again tomorrow, or share a link."
    case 'not_allowed':
      return 'Only the owner and editors can invite people.'
    default:
      return "The invite couldn't be sent. Please try again, or share a link."
  }
}

export function useRevokeInvite(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data, error } = await supabase
        .from('invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', inviteId)
        .select('id')
      if (error) throw error
      if (data.length === 0) throw new Error('not_allowed')
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: inviteKeys.list(groupId) }),
  })
}

// FR-22: requests waiting for the owner. Others see only their own (RLS).
export function usePendingLinkRequests(groupId: string, enabled = true) {
  return useQuery({
    queryKey: inviteKeys.requests(groupId),
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subject_link_requests')
        .select(
          'id, subject_id, user_id, created_at, subject:subjects!inner(name), requester:profiles!subject_link_requests_user_id_fkey(display_name)',
        )
        .eq('group_id', groupId)
        .eq('status', 'pending')
        .order('created_at')
        .overrideTypes<LinkRequest[], { merge: false }>()
      if (error) throw error
      return data
    },
  })
}

export function useDecideLinkRequest(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { requestId: string; approve: boolean }) => {
      const { error } = await supabase.rpc('decide_link_request', {
        request_id: input.requestId,
        approve: input.approve,
      })
      if (error) throw error
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: inviteKeys.requests(groupId) })
      queryClient.invalidateQueries({ queryKey: ['subjects', groupId] })
    },
  })
}

// What the join page shows (FR-20 – FR-22), for logged-in and logged-out
// visitors alike.
export function useInvitePreview(token: string) {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: inviteKeys.preview(token, userId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_invite_preview', {
        invite_token: token,
      })
      if (error) throw error
      return (data[0] ?? { status: 'invalid' }) as unknown as InvitePreview
    },
  })
}

export type JoinChoice = 'new' | 'request' | 'none'

// Joining as the signed-in user.
export function useAcceptInvite(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { choice: JoinChoice; subjectId?: string }) => {
      const { data, error } = await supabase.rpc('accept_invite', {
        invite_token: token,
        choice: input.choice,
        request_subject_id: input.subjectId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  })
}

// Joining with a new account: the redeem-invite Edge Function creates it and
// joins (sign-ups are off, FR-1); then the app logs in with it.
export function useRedeemInvite(token: string) {
  return useMutation({
    mutationFn: async (input: {
      email: string
      password: string
      displayName: string
      choice: JoinChoice
      subjectId?: string
    }) => {
      const { data, error } = await supabase.functions.invoke<{
        groupId?: string
        error?: string
      }>('redeem-invite', { body: { token, ...input } })
      if (error) {
        // The function's own error code is in the response body.
        const body = await (error as { context?: Response }).context
          ?.json()
          .catch(() => null)
        throw new Error(body?.error ?? 'join_failed')
      }
      const signIn = await supabase.auth.signInWithPassword({
        email: input.email,
        password: input.password,
      })
      if (signIn.error) throw new Error('joined_but_login_failed')
      return data!.groupId!
    },
  })
}

// Messages for the errors the database and the function raise on purpose.
export function joinErrorMessage(error: Error) {
  switch (error.message) {
    case 'email_taken':
      return 'There is already an account with this email address. Log in instead, then join.'
    case 'invite_invalid':
      return 'This invite link is no longer valid. Ask for a new one.'
    case 'invite_for_other_email':
      return 'This invite is for a different email address.'
    case 'already_member':
      return "You're already a member of this logbook."
    case 'subject_unavailable':
      return 'That participant is no longer available. Choose another option.'
    case 'member_limit_reached':
      return 'This logbook already has 50 members, the most allowed.'
    case 'group_limit_reached':
      return "You're already in 50 logbooks, the most allowed."
    case 'weak_password':
      return 'Use a password of at least 8 characters.'
    case 'joined_but_login_failed':
      return 'Your account was created. Please log in to continue.'
    default:
      return 'Joining failed. Please try again.'
  }
}
