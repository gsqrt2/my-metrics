import { Link } from 'react-router'

import { PageHeader } from '@/app/layout/page-header'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  return (
    <>
      <PageHeader
        title="Page not found"
        description="This page doesn't exist or was moved."
      />
      <Button asChild variant="outline">
        <Link to="/groups">Back to your groups</Link>
      </Button>
    </>
  )
}
