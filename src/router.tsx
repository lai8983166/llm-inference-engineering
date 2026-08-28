import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppLayout } from '@/ui/AppLayout'
import { BaselineChapterPage } from '@/ui/BaselineChapterPage'
import { ChapterPage } from '@/ui/ChapterPage'
import { ConcurrencyChapterPage } from '@/ui/ConcurrencyChapterPage'
import { HomePage } from '@/ui/HomePage'
import { KvStateChapterPage } from '@/ui/KvStateChapterPage'
import { NotFoundPage } from '@/ui/NotFoundPage'
import { OverloadChapterPage } from '@/ui/OverloadChapterPage'
import { PagedKvChapterPage } from '@/ui/PagedKvChapterPage'
import { SchedulingChapterPage } from '@/ui/SchedulingChapterPage'
import { TerminationChapterPage } from '@/ui/TerminationChapterPage'

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'chapters/trustworthy-baseline', element: <BaselineChapterPage /> },
      { path: 'chapters/single-request', element: <ChapterPage /> },
      { path: 'chapters/naive-concurrency', element: <ConcurrencyChapterPage /> },
      { path: 'chapters/kv-state', element: <KvStateChapterPage /> },
      { path: 'chapters/paged-kv', element: <PagedKvChapterPage /> },
      { path: 'chapters/scheduling', element: <SchedulingChapterPage /> },
      { path: 'chapters/overload', element: <OverloadChapterPage /> },
      { path: 'chapters/termination', element: <TerminationChapterPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

export const router = createBrowserRouter(routes)
