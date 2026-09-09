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

// ---------------------------------------------------------------- dashboard & admin
export const dashboardApi = {
  get: () => api.get<DashboardData>('/dashboard'),
}

export const adminApi = {
  analytics: () => api.get<AnalyticsData>('/admin/analytics'),
  createScheme: (payload: Record<string, unknown>) => api.post<Scheme>('/admin/schemes', payload),
  updateScheme: (id: number, payload: Record<string, unknown>) => api.put<Scheme>(`/admin/schemes/${id}`, payload),
  deleteScheme: (id: number) => api.delete<{ message: string }>(`/admin/schemes/${id}`),
  createPartner: (payload: Record<string, unknown>) => api.post<Partner>('/admin/partners', payload),
  updatePartner: (id: number, payload: Record<string, unknown>) => api.put<Partner>(`/admin/partners/${id}`, payload),
  deletePartner: (id: number) => api.delete<{ message: string }>(`/admin/partners/${id}`),
  config: () => api.get<{ recommendation_weights: Record<string, number>; partner_weights: Record<string, number>; disclaimer: string }>('/admin/config'),
  updateConfig: (payload: Record<string, unknown>) => api.put('/admin/config', payload),
  auditLogs: () =>
    api.get<Array<{ id: number; action: string; entity_type: string; entity_id: string; actor: string; created_at: string }>>('/admin/audit-logs'),
}