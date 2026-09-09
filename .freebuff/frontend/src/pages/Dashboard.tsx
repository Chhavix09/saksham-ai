import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BookmarkX, Calculator, FileText, MapPin, Sparkles, X } from 'lucide-react'
import { useT } from '@/i18n'
import { useAuth } from '@/auth/AuthContext'
import { calculatorApi, dashboardApi, publicApi, usersApi } from '@/api/endpoints'
import { LoadingState, ErrorState, EmptyState, MatchBar, Disclaimer } from '@/components/ui'
import { ApplicationStepper } from '@/components/Steppers'
import { formatINR, formatINRShort, formatDate } from '@/utils/format'
import type { EMIBreakdown } from '@/types'

const STATUS_FLOW = [
  'recommendation_generated',
  'documents_pending',
  'submitted',
  'under_review',
  'approved',
  'disbursed',
]

export default function Dashboard() {
  const { t } = useT()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const dashQuery = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get })
  const configQuery = useQuery({ queryKey: ['public-config'], queryFn: publicApi.config })

  const rec = dashQuery.data?.recommendation ?? null
  const recSchemeId = rec?.scheme_id ?? null

  const schemeQuery = useQuery({
    queryKey: ['scheme', recSchemeId],
    queryFn: () => publicApi.scheme(recSchemeId as number),
    enabled: Boolean(recSchemeId),
  })

  const emiQuery = useQuery<EMIBreakdown | null>({
    queryKey: ['dashboard-emi', recSchemeId],
    queryFn: async () => {
      if (!recSchemeId) return null
      const scheme = await publicApi.scheme(recSchemeId)
      return calculatorApi.scheme({
        scheme_id: scheme.id,
        project_cost: scheme.maximum_loan,
        own_contribution: Math.round(scheme.maximum_loan * scheme.margin_percentage / 100 / (1 + scheme.margin_percentage / 100)),
      })
    },
    enabled: Boolean(recSchemeId),
  })

  const [removing, setRemoving] = useState<number | null>(null)

  async function removeSaved(id: number) {
    setRemoving(id)
    try {
      await usersApi.unsaveScheme(id)
      await dashQuery.refetch()
    } finally {
      setRemoving(null)
    }
  }

  if (dashQuery.isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <LoadingState />
      </div>
    )
  }

  if (dashQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <ErrorState message={t('err.generic')} onRetry={() => dashQuery.refetch()} />
      </div>
    )
  }

  const data = dashQuery.data!
  const breakdown = emiQuery.data
  const statusIndex = data.applications.length > 0 ? STATUS_FLOW.indexOf(data.applications[0].status) : -1

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{t('dash.welcome', { name: data.user.full_name.split(' ')[0] })}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('app.tagline')}</p>
        </div>
        <Link to="/onboarding" className="btn-primary btn-sm">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {t('dash.getStarted')}
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recommendation */}
        <section className="card lg:col-span-2" aria-labelledby="rec-heading">
          <h2 id="rec-heading" className="text-base font-semibold text-slate-900">{t('dash.yourRecommendation')}</h2>
          {!rec ? (
            <EmptyState
              title={t('dash.noRecommendation')}
              action={
                <Link to="/onboarding" className="btn-primary btn-sm">
                  {t('dash.getStarted')}
                </Link>
              }
            />
          ) : (
            <div className="mt-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{rec.scheme_name}</h3>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="badge-brand">{schemeQuery.data?.category ? t(`scheme.category.${schemeQuery.data.category}`) : ''}</span>
                    <span className="text-xs text-slate-400">{formatDate(rec.created_at)}</span>
                  </div>
                </div>
                <div className="rounded-2xl bg-brand-50 px-4 py-2 text-center">
                  <div className="text-2xl font-extrabold text-brand-800">{Math.round(rec.eligibility_score)}%</div>
                  <div className="text-[10px] font-medium text-brand-600">{t('dash.eligibility')}</div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('dash.estimatedFinancing')}</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">{breakdown ? formatINR(breakdown.loan_amount) : '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('dash.estimatedEmi')}</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">{breakdown ? `${formatINR(breakdown.emi)}/mo` : '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('rec.interest')}</p>
                  <p className="mt-0.5 text-lg font-bold text-slate-900">{schemeQuery.data ? `${schemeQuery.data.interest_rate}%` : '—'}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/onboarding" className="btn-secondary btn-sm">{t('dash.viewScheme')}</Link>
                <Link to="/calculator" className="btn-secondary btn-sm">
                  <Calculator className="h-4 w-4" aria-hidden="true" />
                  {t('dash.calcEmi')}
                </Link>
                <Link to="/partners" search={recSchemeId ? { scheme: String(recSchemeId) } : {}} className="btn-secondary btn-sm">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {t('dash.findPartner')}
                </Link>
                <Link to="/application" search={recSchemeId ? { scheme: String(recSchemeId) } : {}} className="btn-primary btn-sm">
                  {t('dash.startApplication')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </section>

        {/* Partner */}
        <section className="card" aria-labelledby="partner-heading">
          <h2 id="partner-heading" className="text-base font-semibold text-slate-900">{t('dash.nearbyPartner')}</h2>
          {!data.nearest_partner ? (
            <p className="mt-3 text-sm text-slate-500">{t('dash.noPartner')}</p>
          ) : (
            <div className="mt-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <MapPin className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{data.nearest_partner.name}</h3>
                  <p className="text-xs text-slate-500">
                    {data.nearest_partner.city}, {data.nearest_partner.state}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="badge-green">{data.nearest_partner.processing_label}</span>
                    <span className="badge-slate">{data.nearest_partner.fund_health}</span>
                  </div>
                </div>
              </div>
              <Link to="/partners" className="btn-ghost mt-3 w-full">
                {t('dash.findPartner')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </section>

        {/* Applications */}
        <section className="card lg:col-span-2" aria-labelledby="app-heading">
          <h2 id="app-heading" className="text-base font-semibold text-slate-900">{t('dash.applicationStatus')}</h2>
          {data.applications.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t('dash.noApplication')}</p>
          ) : (
            <div className="mt-4 space-y-4">
              {data.applications.map((app) => (
                <div key={app.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{app.scheme_name}</p>
                      <p className="text-xs text-slate-500">
                        {app.partner_name ?? 'Channel Partner pending'} · {formatDate(app.updated_at)}
                      </p>
                    </div>
                    <span className="badge-brand">{t(`appl.status.${app.status}`)}</span>
                  </div>
                  <div className="mt-3">
                    <ApplicationStepper status={app.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Saved schemes */}
        <section className="card" aria-labelledby="saved-heading">
          <h2 id="saved-heading" className="text-base font-semibold text-slate-900">{t('dash.savedSchemes')}</h2>
          {data.saved_schemes.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t('dash.noSaved')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.saved_schemes.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{s.scheme_name}</p>
                    <p className="text-xs text-slate-400">
                      {formatINRShort(s.maximum_loan)} · {s.interest_rate}%
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-red-500"
                    onClick={() => removeSaved(s.id)}
                    disabled={removing === s.id}
                    aria-label={`Remove ${s.scheme_name}`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6">
        <Disclaimer text={configQuery.data?.disclaimer ?? t('app.disclaimer')} />
      </div>
    </div>
  )
}