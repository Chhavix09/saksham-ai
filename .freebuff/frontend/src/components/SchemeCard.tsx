import { GraduationCap, Landmark, ShoppingBag, Wallet } from 'lucide-react'
import { useT } from '@/i18n'
import { formatINRShort } from '@/utils/format'
import type { Scheme } from '@/types'

export function categoryIcon(category: string) {
  switch (category) {
    case 'micro_finance':
      return Wallet
    case 'educational':
      return GraduationCap
    case 'term_loan':
      return Landmark
    default:
      return ShoppingBag
  }
}

export function CategoryBadge({ category }: { category: string }) {
  const { t } = useT()
  const label = t(`scheme.category.${category}`)
  const color =
    category === 'micro_finance'
      ? 'badge-green'
      : category === 'educational'
        ? 'badge-brand'
        : category === 'term_loan'
          ? 'badge-amber'
          : 'badge-slate'
  return <span className={color}>{label}</span>
}

export default function SchemeCard({
  scheme,
  matchScore,
  onClick,
  selected = false,
}: {
  scheme: Scheme
  matchScore?: number
  onClick?: () => void
  selected?: boolean
}) {
  const { t } = useT()
  const Icon = categoryIcon(scheme.category)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card w-full text-left transition-all hover:shadow-md ${
        selected ? 'border-2 border-brand-500' : ''
      }`}
      aria-pressed={selected}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-semibold text-slate-900">{scheme.scheme_name}</h3>
            <div className="mt-0.5 flex items-center gap-2">
              <CategoryBadge category={scheme.category} />
            </div>
          </div>
        </div>
        {matchScore !== undefined && (
          <div className="shrink-0 rounded-xl bg-brand-50 px-3 py-1.5 text-center">
            <div className="text-lg font-bold text-brand-800">{Math.round(matchScore)}%</div>
            <div className="text-[10px] font-medium text-brand-600">{t('rec.match')}</div>
          </div>
        )}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 line-clamp-2">{scheme.description}</p>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('rec.maxLoan')}</dt>
          <dd className="text-sm font-semibold text-slate-800">{formatINRShort(scheme.maximum_loan)}</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('rec.interest')}</dt>
          <dd className="text-sm font-semibold text-slate-800">{scheme.interest_rate}%</dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{t('rec.tenure')}</dt>
          <dd className="text-sm font-semibold text-slate-800">{scheme.maximum_tenure_months} mo</dd>
        </div>
      </dl>
    </button>
  )
}