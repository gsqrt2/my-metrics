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
      // The group list is the first page after login (FR-12).
      { index: true, element: <Navigate to="/groups" replace /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'groups/new', element: <NewGroupPage /> },
      { path: 'groups/:groupId', element: <GroupPage /> },
      { path: 'groups/:groupId/edit', element: <EditGroupPage /> },
      { path: 'groups/:groupId/subjects', element: <SubjectsPage /> },
      { path: 'groups/:groupId/subjects/new', element: <NewSubjectPage /> },
      {
        path: 'groups/:groupId/subjects/:subjectId/edit',
        element: <EditSubjectPage />,
      },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
