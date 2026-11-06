import { PageHeader } from '@/app/layout/page-header'
import { Placeholder } from '@/app/placeholder'

export function ProfilePage() {
  return (
    <>
      <PageHeader
        title="Profile"
        description="Your display name, email address and password."
      />
      <Placeholder>
        Profile settings will appear here (plan step 2).
      </Placeholder>
    </>
  )
}
