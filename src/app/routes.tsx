import { Navigate, type RouteObject } from 'react-router'

import { AppLayout } from '@/app/layout/app-layout'
import { NotFoundPage } from '@/app/not-found-page'
import { GroupsPage } from '@/features/groups/groups-page'
import { ProfilePage } from '@/features/profile/profile-page'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      // The group list is the first page after login (FR-12).
      { index: true, element: <Navigate to="/groups" replace /> },
      { path: 'groups', element: <GroupsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
