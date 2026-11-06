const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

// Checks a password with a throwaway login, without touching the app's session.
// Supabase's updateUser doesn't check the current password, so the profile page
// does this first. It guards against someone using an unlocked device; it is
// not a server-side check (see tech.md §3).
export async function verifyPassword(
  email: string,
  password: string,
): Promise<boolean> {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) return false

  // End the throwaway session again; only it, not the user's other sessions.
  const { access_token } = (await response.json()) as { access_token: string }
  await fetch(`${url}/auth/v1/logout?scope=local`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${access_token}`,
    },
  }).catch(() => {})
  return true
}
