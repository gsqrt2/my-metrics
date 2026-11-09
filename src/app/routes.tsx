import { Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/app/layout/app-layout'
import { NotFoundPage } from '@/app/not-found-page'
import { AuthLayout } from '@/features/auth/auth-layout'
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page'
import { LoginPage } from '@/features/auth/login-page'
import { RequireAuth } from '@/features/auth/require-auth'
import { ResetPasswordPage } from '@/features/auth/reset-password-page'
import { EditGroupPage } from '@/features/groups/edit-group-page'
import { GroupPage } from '@/features/groups/group-page'
import { GroupsPage } from '@/features/groups/groups-page'
import { NewGroupPage } from '@/features/groups/new-group-page'
import { ConfirmEmailPage } from '@/features/profile/confirm-email-page'
import { ProfilePage } from '@/features/profile/profile-page'
import { AttributesPage } from '@/features/attributes/attributes-page'
import { EditAttributePage } from '@/features/attributes/edit-attribute-page'
import { NewAttributePage } from '@/features/attributes/new-attribute-page'
import { EditSubjectPage } from '@/features/subjects/edit-subject-page'
import { NewSubjectPage } from '@/features/subjects/new-subject-page'
import { SubjectsPage } from '@/features/subjects/subjects-page'

export const routes: RouteObject[] = [
  {
    // Public pages
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'confirm-email', element: <ConfirmEmailPage /> },
    ],
  },
  {
    // Everything else needs a logged-in user
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      // The logbook (group) list is the first page after login (FR-12).
      { index: true, element: <Navigate to="/logbooks" replace /> },
      { path: 'logbooks', element: <GroupsPage /> },
      { path: 'logbooks/new', element: <NewGroupPage /> },
      { path: 'logbooks/:groupId', element: <GroupPage /> },
      { path: 'logbooks/:groupId/edit', element: <EditGroupPage /> },
      { path: 'logbooks/:groupId/participants', element: <SubjectsPage /> },
      { path: 'logbooks/:groupId/metrics', element: <AttributesPage /> },
      { path: 'logbooks/:groupId/metrics/new', element: <NewAttributePage /> },
      {
        path: 'logbooks/:groupId/metrics/:attributeId/edit',
        element: <EditAttributePage />,
      },
      {
        path: 'logbooks/:groupId/participants/new',
        element: <NewSubjectPage />,
      },
      {
        path: 'logbooks/:groupId/participants/:subjectId/edit',
        element: <EditSubjectPage />,
      },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
