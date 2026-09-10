import { api } from './client'
import type {
  AnalyticsData,
  Application,
  DashboardData,
  EMIBreakdown,
  OnboardingProfile,
  Partner,
  PublicConfig,
  PublicStats,
  RecommendationResult,
  Scheme,
  User,
} from '@/types'

// ---------------------------------------------------------------- auth
export const authApi = {
  register: (payload: Record<string, unknown>) =>
    api.post<{ access_token: string; user: User }>('/auth/register', payload),
  login: (payload: { identifier: string; password: string; remember_me?: boolean }) =>
    api.post<{ access_token: string; user: User }>('/auth/login', payload),
  me: () => api.get<User>('/auth/me'),
  forgotPassword: (identifier: string) => api.post<{ message: string; demo_token?: string | null }>('/auth/forgot-password', { identifier }),
  resetPassword: (token: string, new_password: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, new_password }),
}

// ---------------------------------------------------------------- users
export const usersApi = {
  updateMe: (payload: Partial<User>) => api.put<User>('/users/me', payload),
  savedSchemes: () => api.get<Scheme[]>('/users/me/saved-schemes'),
  saveScheme: (schemeId: number) => api.post<{ message: string }>(`/users/me/saved-schemes/${schemeId}`),
  unsaveScheme: (schemeId: number) => api.delete<{ message: string }>(`/users/me/saved-schemes/${schemeId}`),
}

// ---------------------------------------------------------------- public
export const publicApi = {
  stats: () => api.get<PublicStats>('/public/stats'),
  config: () => api.get<PublicConfig>('/public/config'),
  schemes: () => api.get<Scheme[]>('/schemes'),
  scheme: (id: number) => api.get<Scheme>(`/schemes/${id}`),
}

// ---------------------------------------------------------------- recommendation
export const recommendationApi = {
  create: (profile: OnboardingProfile) => api.post<RecommendationResult>('/recommendations', profile),
  get: (id: number) => api.get<RecommendationResult>(`/recommendations/${id}`),
  latest: () => api.get<RecommendationResult | null>('/recommendations/me/latest'),
}

// ---------------------------------------------------------------- calculator
export const calculatorApi = {
  emi: (payload: {
    project_cost: number
    loan_amount: number
    interest_rate: number
    tenure_months: number
    moratorium_months?: number
    own_contribution?: number
  }) => api.post<EMIBreakdown>('/calculator/emi', payload),
  scheme: (payload: { scheme_id: number; project_cost: number; own_contribution?: number; tenure_months?: number }) =>
    api.post<EMIBreakdown>('/calculator/scheme', payload),
}

// ---------------------------------------------------------------- partners
export const partnersApi = {
  list: () => api.get<Partner[]>('/partners'),
  nearby: (lat: number, lng: number, radiusKm: number, schemeId?: number) =>
    api.get<{ partners: Partner[]; excluded: Partner[] }>(
      `/partners/nearby?latitude=${lat}&longitude=${lng}&radius_km=${radiusKm}${schemeId ? `&scheme_id=${schemeId}` : ''}`,
    ),
  recommend: (payload: {
    latitude?: number
    longitude?: number
    scheme_id?: number
    radius_km?: number
    state?: string
    district?: string
  }) => api.post<{ partners: Partner[]; excluded: Partner[]; weights: Record<string, number> }>('/partners/recommend', payload),
}

// ---------------------------------------------------------------- applications
export const applicationsApi = {
  create: (payload: {
    scheme_id: number
    partner_id?: number
    applicant_info: Record<string, unknown>
    financial_info: Record<string, unknown>
    documents: Array<{ name: string; label: string; provided: boolean }>
  }) => api.post<Application>('/applications', payload),
  list: () => api.get<Application[]>('/applications'),
  get: (id: number) => api.get<Application>(`/applications/${id}`),
  updateStatus: (id: number, status: string) => api.patch<Application>(`/applications/${id}/status`, { status }),
}

// ---------------------------------------------------------------- assistant (AI chatbot)
export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: number
  error?: boolean
}

export const assistantApi = {
  status: () => api.get<{ enabled: boolean; provider: string; model: string | null }>('/assistant/status'),
  chat: (message: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    api.post<{ reply: string; provider: string; used_llm: boolean; topic: string; suggestions: string[] }>('/assistant/chat', {
      message,
      history,
    }),
}

// ---------------------------------------------------------------- dashboard & admin
export const dashboardApi = {
  get: () => api.get<DashboardData>('/dashboard'),
}

export const adminApi = {
  analytics: () => api.get<AnalyticsData>('/admin/analytics'),
  applications: (params?: { status?: string; search?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.status) qs.set('status', params.status)
    if (params?.search) qs.set('search', params.search)
    qs.set('limit', String(params?.limit ?? 50))
    qs.set('offset', String(params?.offset ?? 0))
    return api.get<AdminApplicationsResponse>(`/admin/applications?${qs.toString()}`)
  },
  setApplicationStatus: (id: number, status: string) =>
    api.patch<{ id: number; status: string; message: string }>(`/admin/applications/${id}/status`, { status }),
  createScheme: (payload: Record<string, unknown>) => api.post<Scheme>('/admin/schemes', payload),
  updateScheme: (id: number, payload: Record<string, unknown>) => api.put<Scheme>(`/admin/schemes/${id}`, payload),
  deleteScheme: (id: number) => api.delete<{ message: string }>(`/admin/schemes/${id}`),
  triggerScraper: () =>
    api.post<{ message: string; result: Record<string, unknown>; scheduler_status: Record<string, unknown> }>('/admin/scrape-schemes'),
  scraperStatus: () => api.get<ScraperStatusResponse>('/admin/scraper-status'),
  createPartner: (payload: Record<string, unknown>) => api.post<Partner>('/admin/partners', payload),
  updatePartner: (id: number, payload: Record<string, unknown>) => api.put<Partner>(`/admin/partners/${id}`, payload),
  deletePartner: (id: number) => api.delete<{ message: string }>(`/admin/partners/${id}`),
  config: () => api.get<{ recommendation_weights: Record<string, number>; partner_weights: Record<string, number>; disclaimer: string }>('/admin/config'),
  updateConfig: (payload: Record<string, unknown>) => api.put('/admin/config', payload),
  auditLogs: () =>
    api.get<
      Array<{
        id: number
        action: string
        entity_type: string
        entity_id: string
        entity_label: string
        details: Record<string, unknown>
        actor: string
        created_at: string
      }>
    >('/admin/audit-logs'),
  users: (params: { search?: string; role?: string; active?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params.search) qs.set('search', params.search)
    if (params.role) qs.set('role', params.role)
    if (params.active) qs.set('active', params.active)
    qs.set('limit', String(params.limit ?? 50))
    qs.set('offset', String(params.offset ?? 0))
    return api.get<AdminUsersResponse>(`/admin/users?${qs.toString()}`)
  },
  setUserStatus: (id: number, is_active: boolean) =>
    api.patch<{ id: number; is_active: boolean; message: string }>(`/admin/users/${id}/status`, { is_active }),
  setUserRole: (id: number, role: string) =>
    api.patch<{ id: number; role: string; message: string }>(`/admin/users/${id}/role`, { role }),
  system: () => api.get<SystemOverview>('/admin/system'),
}

export interface AdminApplicationRow {
  id: number
  scheme_name: string | null
  partner_name: string | null
  applicant: string
  email: string | null
  status: string
  loan_amount: number | null
  documents_provided: number
  documents_total: number
  created_at: string | null
  updated_at: string | null
}

export interface AdminApplicationsResponse {
  total: number
  applications: AdminApplicationRow[]
}

export interface AdminUserRow extends User {
  is_active: boolean
  created_at: string | null
  recommendations: number
  applications: number
  chat_messages: number
}

export interface AdminUsersResponse {
  total: number
  users: AdminUserRow[]
}

export interface SystemOverview {
  users: {
    total: number
    active: number
    admins: number
    new_week: number
    new_month: number
    growth: Array<{ week: string; count: number }>
  }
  ai: {
    total_chats: number
    chats_today: number
    chats_week: number
    llm_chats: number
    fallback_chats: number
    failed_chats: number
    avg_latency_ms: number | null
    by_provider: Array<{ provider: string; count: number }>
    by_topic: Array<{ topic: string; count: number }>
  }
  recent_registrations: Array<{
    id: number
    full_name: string
    email: string
    role: string
    is_active: boolean
    created_at: string | null
  }>
  database: {
    dialect: string
    latency_ms: number | null
    tables: Record<string, number | null>
  }
}

export interface ScraperStatusResponse {
  scheduler: {
    is_active: boolean
    status: string
    interval_seconds: number
    interval_hours: number
    last_run: string | null
    next_run: string | null
    seconds_until_next_run: number | null
    last_result: {
      status?: string
      scraped_count?: number
      persisted_count?: number
      timestamp?: string
      detail?: string
    }
  }
  database_stats: {
    total_schemes: number
    active_schemes: number
    top_sponsoring_bodies: Array<{ name: string; count: number }>
  }
}