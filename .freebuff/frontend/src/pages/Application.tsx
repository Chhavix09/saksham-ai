import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CheckCircle2, FileCheck2, LogIn, Send } from 'lucide-react'
import { useT } from '@/i18n'
import { useAuth } from '@/auth/AuthContext'
import { applicationsApi, partnersApi, publicApi } from '@/api/endpoints'
import { Field, Disclaimer, LoadingState, ErrorState, EmptyState } from '@/components/ui'
import { ProgressStepper } from '@/components/Steppers'
import SchemeCard from '@/components/SchemeCard'
import DocumentChecklist, { requiredDocumentsToItems } from '@/components/DocumentChecklist'
import { PartnerCard } from '@/components/PartnerComponents'
import type { DocumentItem, Partner, Scheme } from '@/types'
import { slugLabel } from '@/utils/format'

const STEPS = ['appl.step1', 'appl.step2', 'appl.step3', 'appl.step4', 'appl.step5', 'appl.step6']

export default function Application() {
  const { t } = useT()
  const navigate = useNavigate()
  const { user } = useAuth()
  const search = useSearch({ from: '/application' })

  const schemesQuery = useQuery({ queryKey: ['schemes'], queryFn: publicApi.schemes })

  const [step, setStep] = useState(0)
  const [schemeId, setSchemeId] = useState<string>(search.scheme ?? '')
  const [partnerId, setPartnerId] = useState<string>(search.partner ?? '')
  const [applicant, setApplicant] = useState({
    full_name: user?.full_name ?? '',
    age: String(user?.age ?? ''),
    state: user?.state ?? '',
    district: user?.district ?? '',
    income: String(user?.annual_income ?? ''),
  })
  const [finance, setFinance] = useState({ project_cost: '', loan_amount: '', own_contribution: '' })
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [submitted, setSubmitted] = useState<{ id: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const schemes = schemesQuery.data ?? []
  const scheme = schemes.find((s: Scheme) => String(s.id) === schemeId) ?? null

  const partnersQuery = useQuery({
    queryKey: ['partners-for-application', schemeId],
    queryFn: () =>
      partnersApi.recommend({
        state: applicant.state || undefined,
        district: applicant.district || undefined,
        scheme_id: schemeId ? Number(schemeId) : undefined,
        radius_km: 200,
      }),
    enabled: Boolean(schemeId) && step === 4,
  })

  useEffect(() => {
    if (search.scheme) setSchemeId(search.scheme)
    if (search.partner) setPartnerId(search.partner)
  }, [search.scheme, search.partner])

  useEffect(() => {
    if (scheme) setDocuments(requiredDocumentsToItems(scheme.required_documents))
  }, [scheme])

  // Prefill finance from the recommended scheme's typical numbers
  useEffect(() => {
    if (scheme) {
      const project = 1000000
      const contribution = Math.round(project * scheme.margin_percentage / 100)
      setFinance({ project_cost: String(project), loan_amount: String(project - contribution), own_contribution: String(contribution) })
    }
  }, [scheme])

  const steps = useMemo(() => STEPS.map((k) => t(k)), [t])

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <EmptyState
          title={t('appl.notLoggedIn')}
          action={
            <Link to="/login" className="btn-primary">
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {t('appl.loginNow')}
            </Link>
          }
        />
      </div>
    )
  }

  const set = (patch: Partial<typeof applicant>) => setApplicant((a) => ({ ...a, ...patch }))

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return Boolean(schemeId)
      case 1:
        return Boolean(applicant.full_name && applicant.state)
      case 2:
        return Boolean(finance.project_cost && finance.loan_amount)
      case 3:
        return documents.length > 0
      case 4:
        // Partner selection is optional: the application can still be recorded
        // and the Channel Partner chosen later.
        return true
      default:
        return true
    }
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await applicationsApi.create({
        scheme_id: Number(schemeId),
        partner_id: partnerId ? Number(partnerId) : undefined,
        applicant_info: {
          full_name: applicant.full_name,
          age: Number(applicant.age) || undefined,
          state: applicant.state,
          district: applicant.district,
          annual_income: Number(applicant.income) || undefined,
        },
        financial_info: {
          project_cost: Number(finance.project_cost) || 0,
          loan_amount: Number(finance.loan_amount) || 0,
          own_contribution: Number(finance.own_contribution) || 0,
        },
        documents,
      })
      setSubmitted({ id: res.id })
      setStep(6)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('err.generic'))
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-green-600" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">{t('appl.submitted')}</h1>
        <p className="mt-2 text-sm text-slate-500">{t('appl.submittedDesc')}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/dashboard" className="btn-primary">
            {t('appl.viewStatus')}
          </Link>
          <Link to="/" className="btn-secondary">
            {t('err.notFound.home')}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{t('appl.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('appl.subtitle')}</p>
      </div>

      <div className="mb-6 overflow-x-auto">
        <ProgressStepper steps={steps} current={Math.min(step, 5)} />
      </div>

      {schemesQuery.isLoading ? (
        <LoadingState />
      ) : schemesQuery.isError ? (
        <ErrorState message={t('err.generic')} onRetry={() => schemesQuery.refetch()} />
      ) : (
        <form
          className="card fade-up"
          onSubmit={(e) => {
            e.preventDefault()
            if (step < 5) setStep((s) => s + 1)
            else void submit()
          }}
        >
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">{t('appl.selectScheme')}</h2>
              <div className="space-y-3">
                {schemes.map((s: Scheme) => (
                  <SchemeCard
                    key={s.id}
                    scheme={s}
                    selected={String(s.id) === schemeId}
                    onClick={() => setSchemeId(String(s.id))}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">{t('appl.step2')}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('appl.fullName')}>
                  <input className="input" value={applicant.full_name} onChange={(e) => set({ full_name: e.target.value })} required />
                </Field>
                <Field label={t('appl.age')}>
                  <input className="input" type="number" min={15} max={100} value={applicant.age} onChange={(e) => set({ age: e.target.value })} />
                </Field>
                <Field label={t('appl.state')}>
                  <input className="input" value={applicant.state} onChange={(e) => set({ state: e.target.value })} required />
                </Field>
                <Field label={t('appl.district')}>
                  <input className="input" value={applicant.district} onChange={(e) => set({ district: e.target.value })} />
                </Field>
                <Field label={t('appl.income')}>
                  <input className="input" type="number" min={0} value={applicant.income} onChange={(e) => set({ income: e.target.value })} />
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">{t('appl.step3')}</h2>
              <p className="text-xs text-slate-400">{t('appl.financialHint')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('appl.projectCost')}>
                  <input className="input" type="number" min={0} value={finance.project_cost} onChange={(e) => setFinance((f) => ({ ...f, project_cost: e.target.value }))} required />
                </Field>
                <Field label={t('appl.loanAmount')}>
                  <input className="input" type="number" min={0} value={finance.loan_amount} onChange={(e) => setFinance((f) => ({ ...f, loan_amount: e.target.value }))} required />
                </Field>
                <Field label={t('appl.ownContribution')}>
                  <input className="input" type="number" min={0} value={finance.own_contribution} onChange={(e) => setFinance((f) => ({ ...f, own_contribution: e.target.value }))} />
                </Field>
                {scheme && (
                  <Field label={t('appl.purpose')}>
                    <input className="input" value={slugLabel(scheme.category === 'educational' ? 'education' : 'start_business')} disabled />
                  </Field>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <FileCheck2 className="h-5 w-5 text-brand-700" aria-hidden="true" />
                {t('appl.documents')}
              </h2>
              <DocumentChecklist items={documents} onChange={setDocuments} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">{t('appl.selectPartner')}</h2>
              {partnersQuery.isLoading ? (
                <LoadingState />
              ) : partnersQuery.isError ? (
                <ErrorState message={t('err.generic')} onRetry={() => partnersQuery.refetch()} />
              ) : (partnersQuery.data?.partners ?? []).length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">{t('part.noPartners')}</p>
                  <p className="rounded-xl bg-brand-50 p-3 text-sm text-brand-900">{t('appl.partnerOptional')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {partnersQuery.data!.partners.slice(0, 5).map((partner: Partner, index) => (
                    <button
                      key={partner.id}
                      type="button"
                      className="w-full text-left"
                      onClick={() => setPartnerId(String(partner.id))}
                      aria-pressed={String(partner.id) === partnerId}
                    >
                      <div className={`rounded-2xl transition-all ${String(partner.id) === partnerId ? 'ring-2 ring-brand-500' : ''}`}>
                        <PartnerCard partner={partner} rank={index + 1} recommended={index === 0} onView={() => undefined} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">{t('appl.reviewTitle')}</h2>
              <p className="text-sm text-slate-500">{t('appl.reviewDesc')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ReviewItem label={t('appl.step1')} value={scheme?.scheme_name ?? '—'} />
                <ReviewItem
                  label={t('appl.step5')}
                  value={partnersQuery.data?.partners?.find((p: Partner) => String(p.id) === partnerId)?.name ?? '—'}
                />
                <ReviewItem label={t('appl.fullName')} value={applicant.full_name} />
                <ReviewItem label={t('appl.projectCost')} value={finance.project_cost} />
                <ReviewItem label={t('appl.loanAmount')} value={finance.loan_amount} />
                <ReviewItem
                  label={t('appl.documents')}
                  value={`${documents.filter((d) => d.provided).length}/${documents.length} ${t('common.required')}`}
                />
              </div>
              {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button type="button" className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t('common.back')}
            </button>
            {step < 5 ? (
              <button type="submit" className="btn-primary" disabled={!canProceed()}>
                {t('common.next')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button type="submit" className="btn-saffron" disabled={busy}>
                <Send className="h-4 w-4" aria-hidden="true" />
                {busy ? t('common.loading') : t('appl.submit')}
              </button>
            )}
          </div>
        </form>
      )}

      <div className="mt-6">
        <Disclaimer text={t('app.disclaimer')} />
      </div>
    </div>
  )
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  )
}