export type UserRole = 'applicant' | 'entrepreneur' | 'student' | 'admin'

export interface User {
  id: number
  full_name: string
  mobile: string
  email: string
  role: UserRole
  preferred_language: string
  age?: number | null
  state?: string | null
  district?: string | null
  annual_income?: number | null
  occupation?: string | null
  category?: string | null
  education_status?: string | null
}

export interface Scheme {
  id: number
  scheme_name: string
  category: string
  description: string
  minimum_income: number | null
  maximum_income: number | null
  minimum_loan: number
  maximum_loan: number
  interest_rate: number
  margin_percentage: number
  moratorium_months: number
  maximum_tenure_months: number
  eligible_purposes: string[]
  eligible_education_types: string[]
  eligibility_rules: Record<string, unknown>
  required_documents: string[]
  fund_utilization: number | null
  is_demo: boolean
  active: boolean
  created_at?: string
  updated_at?: string
}

export interface Partner {
  id: number
  name: string
  partner_type: 'SCA' | 'PSB' | 'RRB' | 'NBFC-MFI' | string
  address: string
  state: string
  district: string
  city: string
  pincode: string
  latitude: number
  longitude: number
  contact_person: string
  phone: string
  email: string
  fund_utilization_percent: number
  processing_status: string
  npa_indicator: string
  is_active: boolean
  is_demo: boolean
  supported_scheme_ids: number[]
  distance_km?: number
  recommendation_score?: number
  scheme_supported?: boolean
  fund_health?: string
  processing_label?: string
  excluded_reason?: string
  breakdown?: Record<string, number>
}

export interface ExplanationItem {
  factor: string
  label: string
  text: string
  matched: boolean
  partial: boolean
  score: number
}

export interface RecommendedScheme extends Scheme {
  eligibility_score?: number
  confidence_score?: number
  match_breakdown?: Record<string, { score: number; matched: boolean; partial: boolean }>
}

export interface RecommendationResult {
  id: number
  recommended_scheme: RecommendedScheme | null
  alternative_schemes: Array<RecommendedScheme & { explanation?: ExplanationItem[]; failed_factors?: Array<{ factor: string; label: string }>; notes?: string[] }>
  eligibility_score: number
  confidence_score: number
  match_breakdown: Record<string, { score: number; matched: boolean; partial: boolean }>
  explanation: ExplanationItem[]
  next_steps: string[]
  created_at?: string | null
  is_demo_note: boolean
}

export interface EMIBreakdown {
  project_cost: number
  own_contribution: number
  loan_amount: number
  interest_rate: number
  tenure_months: number
  moratorium_months: number
  emi: number
  total_interest: number
  total_repayment: number
  principal: number
  interest: number
  monthly_interest_rate: number
  interest_during_moratorium: number
  effective_principal: number
  disclaimer: string
  scheme_id?: number | null
  scheme_name?: string | null
  limit_message?: string | null
  is_estimate: boolean
}

export interface Application {
  id: number
  user_id: number
  scheme_id: number
  partner_id: number | null
  status: string
  applicant_info: Record<string, unknown>
  financial_info: Record<string, unknown>
  documents: DocumentItem[]
  review_notes: string
  scheme_name: string | null
  partner_name: string | null
  created_at: string
  updated_at: string
}

export interface DocumentItem {
  name: string
  label: string
  provided: boolean
}

export interface DashboardData {
  user: { full_name: string; role: string; preferred_language: string }
  recommendation: {
    id: number
    scheme_name: string | null
    scheme_id: number | null
    eligibility_score: number
    confidence_score: number
    match_breakdown: Record<string, unknown>
    created_at: string | null
  } | null
  applications: Array<{
    id: number
    scheme_name: string
    partner_name: string | null
    status: string
    created_at: string
    updated_at: string
  }>
  saved_schemes: Array<{ id: number; scheme_name: string; category: string; interest_rate: number; maximum_loan: number }>
  nearest_partner: Partner | null
  partner_total: number
}

export interface AnalyticsData {
  total_users: number
  total_recommendations: number
  total_applications: number
  applications_submitted: number
  conversion_rate: number
  top_schemes: Array<{ scheme_name: string; count: number }>
  top_districts: Array<{ district: string; count: number }>
  partner_utilization: Array<{ name: string; utilization: number; status: string }>
  applications_by_status: Record<string, number>
}

export interface PublicStats {
  stats: {
    languages: number
    partners: number
    schemes: number
    recommendations: number
    ai_matching?: string
  }
  languages: string[]
}

export interface PublicConfig {
  recommendation_weights: Record<string, number>
  partner_weights: Record<string, number>
  disclaimer: string
  languages: string[]
  app_name: string
  tagline: string
}

export interface OnboardingProfile {
  age?: number
  state?: string
  district?: string
  income?: number
  occupation?: string
  category?: string
  education_status?: string
  purpose?: string
  project_cost?: number
  existing_business?: boolean
  expected_monthly_income?: number
  required_loan?: number
  own_contribution?: number
  education_type?: string
  course?: string
  institution_type?: string
  course_duration?: string
  tuition_cost?: number
  other_education_expenses?: number
  city?: string
  pincode?: string
  latitude?: number
  longitude?: number
  location?: {
    state?: string
    district?: string
    city?: string
    pincode?: string
    latitude?: number
    longitude?: number
  }
}