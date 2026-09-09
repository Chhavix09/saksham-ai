import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowRight, BadgeCheck, Bookmark, BookmarkCheck, CheckCircle2, Info, ListChecks, ShieldCheck, XCircle } from 'lucide-react'
import { useT } from '@/i18n'
import { formatINR, formatINRShort } from '@/utils/format'
import { MatchBar, Disclaimer } from '@/components/ui'
import SchemeCard, { CategoryBadge } from '@/components/SchemeCard'
import type { EMIBreakdown, ExplanationItem, RecommendationResult, Scheme } from '@/types'

export function ExplanationCard({ explanation, weights }: { explanation: ExplanationItem[]; weights?: Record<string, number> }) {
  const { t } = useT()
  return (
    <section className="card" aria-labelledby="why-heading">
      <h2 id="why-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        <BadgeCheck className="h-5 w-5 text-brand-700" aria-hidden="true" />
        {t('rec.whyTitle')}
      </h2>
      <ul className="mt-4 space-y-4">
        {explanation.map((item) => {
          const Icon = item.matched ? CheckCircle2 : item.partial ? Info : XCircle
          const iconColor = item.matched ? 'text-green-600' : item.partial ? 'text-amber-500' : 'text-red-500'
          const weight = weights?.[item.factor]
          return (
            <li key={item.factor} className="flex gap-3">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{t(`rec.factor.${item.factor}`)}</p>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">
                    {Math.round(item.score)}%{weight !== undefined ? ` · ${weight}%` : ''}
                  </span>
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{item.text}</p>
                <div className="mt-1.5">
                  <MatchBar score={item.score} colorClass={item.matched ? 'bg-brand-600' : item.partial ? 'bg-amber-400' : 'bg-red-400'} />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-5 flex items-start gap-2 rounded-xl bg-brand-50 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-brand-900">{t('rec.finalNote')}</p>
      </div>
    </section>
  )
}

export function RecommendationCard({
  result,
  weights,
  saved,
  onToggleSave,
  onCalcEmi,
}: {
  result: RecommendationResult
  weights?: Record<string, number>
  saved?: boolean
  onToggleSave?: () => void
  onCalcEmi?: () => void
}) {
  const { t } = useT()
  const scheme = result.recommended_scheme

  if (!scheme) {
    return (
      <section className="card" aria-label={t('rec.noMatch.title')}>
        <h2 className="text-lg font-semibold text-slate-900">{t('rec.noMatch.title')}</h2>
        <p className="mt-2 text-sm text-slate-600">{t('rec.noMatch.desc')}</p>
      </section>
    )
  }

  return (
    <section className="card fade-up" aria-label={scheme.scheme_name}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{t('dash.yourRecommendation')}</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">{scheme.scheme_name}</h2>
          <div className="mt-1.5">
            <CategoryBadge category={scheme.category} />
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl bg-brand-50 px-4 py-2.5">
          <div className="text-center">
            <div className="text-2xl font-extrabold text-brand-800">{Math.round(result.eligibility_score)}%</div>
            <div className="text-[10px] font-medium text-brand-600">{t('rec.match')}</div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-600">{scheme.description}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('rec.maxLoan')}</dt>
          <dd className="mt-0.5 text-base font-bold text-slate-900">{formatINRShort(scheme.maximum_loan)}</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('rec.interest')}</dt>
          <dd className="mt-0.5 text-base font-bold text-slate-900">{scheme.interest_rate}%</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('rec.tenure')}</dt>
          <dd className="mt-0.5 text-base font-bold text-slate-900">{scheme.maximum_tenure_months} mo</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('rec.margin')}</dt>
          <dd className="mt-0.5 text-base font-bold text-slate-900">{scheme.margin_percentage}%</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/application" search={{ scheme: String(scheme.id) }} className="btn-primary">
          {t('rec.startApplication')}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <button type="button" className="btn-secondary" onClick={onCalcEmi}>
          {t('rec.calcEmi')}
        </button>
        <Link to="/partners" search={{ scheme: String(scheme.id) }} className="btn-secondary">
          {t('rec.findPartner')}
        </Link>
        {onToggleSave && (
          <button type="button" className="btn-ghost" onClick={onToggleSave} aria-pressed={saved}>
            {saved ? (
              <>
                <BookmarkCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
                {t('rec.saved')}
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" aria-hidden="true" />
                {t('rec.save')}
              </>
            )}
          </button>
        )}
      </div>
    </section>
  )
}

export function EMIBreakdownCard({ breakdown }: { breakdown: EMIBreakdown }) {
  const { t } = useT()
  const items = [
    { label: t('calc.projectCostLabel'), value: formatINR(breakdown.project_cost) },
    { label: t('calc.contribution'), value: formatINR(breakdown.own_contribution) },
    { label: t('calc.loanLabel'), value: formatINR(breakdown.loan_amount) },
    { label: t('calc.interestRate'), value: `${breakdown.interest_rate}%` },
    { label: t('calc.tenure'), value: `${breakdown.tenure_months} ${t('calc.monthsUnit')}` },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl bg-brand-700 p-5 text-white">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-100">{t('calc.emi')}</p>
        <p className="mt-1 text-3xl font-extrabold">{formatINR(breakdown.emi)}<span className="text-base font-semibold text-brand-200">/mo</span></p>
        <p className="mt-2 text-xs text-brand-100">
          {breakdown.moratorium_months > 0
            ? `Moratorium: ${breakdown.moratorium_months} mo · Interest during moratorium: ${formatINR(breakdown.interest_during_moratorium)}`
            : t('app.estimated')}
        </p>
      </div>
      <dl className="grid grid-cols-1 gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
            <dt className="text-xs font-medium text-slate-500">{item.label}</dt>
            <dd className="text-sm font-semibold text-slate-800">{item.value}</dd>
          </div>
        ))}
      </dl>
      <div className="grid grid-cols-2 gap-3 sm:col-span-2">
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-xs font-medium text-slate-500">{t('calc.totalInterest')}</p>
          <p className="mt-0.5 text-lg font-bold text-slate-900">{formatINR(breakdown.total_interest)}</p>
        </div>
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-xs font-medium text-slate-500">{t('calc.totalRepayment')}</p>
          <p className="mt-0.5 text-lg font-bold text-slate-900">{formatINR(breakdown.total_repayment)}</p>
        </div>
      </div>
      {breakdown.limit_message && (
        <p className="sm:col-span-2 rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900" role="alert">
          {breakdown.limit_message}
        </p>
      )}
    </div>
  )
}

export function AlternativeSchemes({ result }: { result: RecommendationResult }) {
  const { t } = useT()
  if (!result.alternative_schemes.length) return null
  return (
    <section aria-labelledby="alternatives-heading">
      <h2 id="alternatives-heading" className="section-title mb-4">{t('rec.alternatives')}</h2>
      <div className="space-y-3">
        {result.alternative_schemes.map((alt) => (
          <div key={alt.id} className="card">
            <SchemeCard scheme={alt as Scheme} matchScore={alt.eligibility_score ?? 0} />
            {alt.failed_factors && alt.failed_factors.length > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3">
                <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                <ul className="text-xs text-slate-600">
                  {alt.failed_factors.map((f) => (
                    <li key={f.factor}>✗ {t(`rec.factor.${f.factor}`)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function NextStepsList({ steps }: { steps: string[] }) {
  const { t } = useT()
  if (!steps.length) return null
  return (
    <section className="card" aria-labelledby="next-heading">
      <h2 id="next-heading" className="text-lg font-semibold text-slate-900">{t('rec.nextSteps')}</h2>
      <ol className="mt-3 space-y-2.5">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800" aria-hidden="true">
              {i + 1}
            </span>
            <span className="text-sm text-slate-700">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function useEmiFromScheme(scheme: Scheme | null, projectCost: number, ownContribution?: number) {
  return useMemo(() => {
    if (!scheme) return null
    return {
      scheme_id: scheme.id,
      project_cost: projectCost || scheme.maximum_loan,
      own_contribution: ownContribution,
    }
  }, [scheme, projectCost, ownContribution])
}