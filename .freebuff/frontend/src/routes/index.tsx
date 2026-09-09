import { createRootRoute, createRoute, createRouter, redirect } from '@tanstack/react-router'
import { lazy } from 'react'
import RootLayout from '@/layouts/RootLayout'
import { getToken } from '@/api/client'
import type { User } from '@/types'

const Home = lazy(() => import('@/pages/Home'))
const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))
const Onboarding = lazy(() => import('@/pages/Onboarding'))
const Recommendations = lazy(() => import('@/pages/Recommendations'))
const Calculator = lazy(() => import('@/pages/Calculator'))
const Partners = lazy(() => import('@/pages/Partners'))
const Application = lazy(() => import('@/pages/Application'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Admin = lazy(() => import('@/pages/Admin'))
const NotFound = lazy(() => import('@/pages/NotFound'))

function readUser(): User | null {
  try {
    const raw = localStorage.getItem('saksham_user')
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function requireAuth() {
  if (!getToken()) {
    throw redirect({ to: '/login' })
  }
}

function requireAdmin() {
  const user = readUser()
  if (!getToken()) {
    throw redirect({ to: '/login' })
  }
  if (user?.role !== 'admin') {
    throw redirect({ to: '/dashboard' })
  }
}

const rootRoute = createRootRoute({
  component: RootLayout,
})

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Home })

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
  validateSearch: (search: Record<string, unknown>): { next?: string } => ({
    next: typeof search.next === 'string' ? search.next : undefined,
  }),
})

const registerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/register', component: Register })

const onboardingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/onboarding', component: Onboarding })

const recommendationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recommendations',
  component: Recommendations,
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === 'string' ? search.id : undefined,
  }),
})

const calculatorRoute = createRoute({ getParentRoute: () => rootRoute, path: '/calculator', component: Calculator })

const partnersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/partners',
  component: Partners,
  validateSearch: (search: Record<string, unknown>): { scheme?: string; partner?: string } => ({
    scheme: typeof search.scheme === 'string' ? search.scheme : undefined,
    partner: typeof search.partner === 'string' ? search.partner : undefined,
  }),
})

const applicationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/application',
  component: Application,
  validateSearch: (search: Record<string, unknown>): { scheme?: string; partner?: string } => ({
    scheme: typeof search.scheme === 'string' ? search.scheme : undefined,
    partner: typeof search.partner === 'string' ? search.partner : undefined,
  }),
})

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  beforeLoad: requireAuth,
  component: Dashboard,
})

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  beforeLoad: requireAdmin,
  component: Admin,
})

const notFoundRoute = createRoute({ getParentRoute: () => rootRoute, path: '$', component: NotFound })

const routeTree = rootRoute.addChildren([
  homeRoute,
  loginRoute,
  registerRoute,
  onboardingRoute,
  recommendationsRoute,
  calculatorRoute,
  partnersRoute,
  applicationRoute,
  dashboardRoute,
  adminRoute,
  notFoundRoute,
])

export const router = createRouter({ routeTree, defaultPreload: 'intent' })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}