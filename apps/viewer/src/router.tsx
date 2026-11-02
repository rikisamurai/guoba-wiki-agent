import {
  Outlet,
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { RunListPage } from './pages/run-list.tsx'
import { ChangesPage } from './pages/run/changes.tsx'
import { RunLayout } from './pages/run/layout.tsx'
import { LedgerPage } from './pages/run/ledger.tsx'
import { RequestPage } from './pages/run/request.tsx'
import { TimelinePage } from './pages/run/timeline.tsx'

const text = (value: unknown) => (typeof value === 'string' && value !== '' ? value : undefined)
const int = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) ? value : undefined

const rootRoute = createRootRoute({ component: Outlet })
const listRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: RunListPage,
})
const runRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs/$runId',
  component: RunLayout,
})
const ledgerRoute = createRoute({
  getParentRoute: () => runRoute,
  path: '/',
  component: LedgerPage,
  validateSearch: (search: Record<string, unknown>): { sel?: string } => ({
    ...(text(search['sel']) && { sel: text(search['sel']) }),
  }),
})
const timelineRoute = createRoute({
  getParentRoute: () => runRoute,
  path: 'timeline',
  component: TimelinePage,
})
const changesRoute = createRoute({
  getParentRoute: () => runRoute,
  path: 'changes',
  component: ChangesPage,
  validateSearch: (search: Record<string, unknown>): { turn?: number; file?: string } => ({
    ...(int(search['turn']) !== undefined && { turn: int(search['turn']) }),
    ...(text(search['file']) && { file: text(search['file']) }),
  }),
})
const requestRoute = createRoute({
  getParentRoute: () => runRoute,
  path: 'request',
  component: RequestPage,
  validateSearch: (search: Record<string, unknown>): { part?: string } => ({
    ...(text(search['part']) && { part: text(search['part']) }),
  }),
})

const routeTree = rootRoute.addChildren([
  listRoute,
  runRoute.addChildren([ledgerRoute, timelineRoute, changesRoute, requestRoute]),
])

/** hash 路由：#/、#/runs/:id、#/runs/:id/timeline|changes|request（ADR 0015）。 */
export const router = createRouter({ routeTree, history: createHashHistory() })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
