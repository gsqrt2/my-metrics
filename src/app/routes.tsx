import { Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/app/layout/app-layout'
import { NotFoundPage } from '@/app/not-found-page'
import { AuthLayout } from '@/features/auth/auth-layout'
import { ForgotPasswordPage } from '@/features/auth/forgot-password-page'
import { LoginPage } from '@/features/auth/login-page'
import { RequireAuth } from '@/features/auth/require-auth'
import { ResetPasswordPage } from '@/features/auth/reset-password-page'
import { GroupsPage } from '@/features/groups/groups-page'
import { ConfirmEmailPage } from '@/features/profile/confirm-email-page'
import { ProfilePage } from '@/features/profile/profile-page'

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
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
