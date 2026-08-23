import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppLayout } from '@/ui/AppLayout'
import { BaselineChapterPage } from '@/ui/BaselineChapterPage'
import { ChapterPage } from '@/ui/ChapterPage'
import { HomePage } from '@/ui/HomePage'
import { NotFoundPage } from '@/ui/NotFoundPage'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'chapters/trustworthy-baseline', element: <BaselineChapterPage /> },
      { path: 'chapters/single-request', element: <ChapterPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
