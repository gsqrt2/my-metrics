import { PageHeader } from '@/app/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/features/auth/use-auth'
import { DisplayNameCard } from '@/features/profile/display-name-card'
import { EmailCard } from '@/features/profile/email-card'
import { PasswordCard } from '@/features/profile/password-card'
import { useProfile } from '@/features/profile/use-profile'

// FR-2: display name, email address and password.
export function ProfilePage() {
  const { session } = useAuth()
  const profile = useProfile()
  const user = session!.user // RequireAuth guarantees a session here.

  return (
    <>
      <PageHeader
        title="Profile"
        description="Your display name, email address and password."
      />
      <div className="flex max-w-xl flex-col gap-6">
        {profile.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              Your profile couldn't be loaded. Please reload the page.
            </AlertDescription>
          </Alert>
        )}
        {profile.data && (
          <DisplayNameCard
            userId={user.id}
            displayName={profile.data.display_name}
          />
        )}
        <EmailCard email={user.email ?? ''} pendingEmail={user.new_email} />
        <PasswordCard email={user.email ?? ''} />
      </div>
    </>
  )
}
