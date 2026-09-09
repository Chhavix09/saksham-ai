import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Calculator as CalcIcon, PieChart as PieChartIcon } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { useT } from '@/i18n'
import { calculatorApi, publicApi } from '@/api/endpoints'
import { Field, Disclaimer, ErrorState, LoadingState } from '@/components/ui'
import { EMIBreakdownCard } from '@/components/RecommendationComponents'
import type { EMIBreakdown, Scheme } from '@/types'

export default function Calculator() {
  const { t } = useT()
  const schemesQuery = useQuery({ queryKey: ['schemes'], queryFn: publicApi.schemes })

  const [schemeId, setSchemeId] = useState<string>('')
  const [projectCost, setProjectCost] = useState('1000000')
  const [loanAmount, setLoanAmount] = useState('900000')
  const [interestRate, setInterestRate] = useState('7.0')
  const [tenure, setTenure] = useState('5')
  const [moratorium, setMoratorium] = useState('0')
  const [ownContribution, setOwnContribution] = useState('100000')
  const [result, setResult] = useState<EMIBreakdown | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const selectedScheme = schemesQuery.data?.find((s: Scheme) => String(s.id) === schemeId)

  useEffect(() => {
    if (selectedScheme) {
      setInterestRate(String(selectedScheme.interest_rate))
      setMoratorium(String(selectedScheme.moratorium_months))
      setTenure(String(Math.max(1, Math.round(selectedScheme.maximum_tenure_months / 12))))
    }
  }, [selectedScheme])

  async function calculate(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (selectedScheme) {
        const res = await calculatorApi.scheme({
          scheme_id: selectedScheme.id,
          project_cost: Number(projectCost) || 0,
          own_contribution: Number(ownContribution) || 0,
        })
        setResult(res)
      } else {
        const res = await calculatorApi.emi({
          project_cost: Number(projectCost) || 0,
          loan_amount: Number(loanAmount) || 0,
          interest_rate: Number(interestRate) || 0,
          tenure_months: Math.max(1, Math.round((Number(tenure) || 1) * 12)),
          moratorium_months: Number(moratorium) || 0,
          own_contribution: Number(ownContribution) || 0,
        })
        setResult(res)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('err.generic'))
    } finally {
      setBusy(false)
    }
  }

  const chartData =
    result && result.total_interest >= 0
      ? [
          { name: t('calc.principal'), value: Math.round(result.loan_amount), color: '#14644d' },
          { name: t('calc.interest'), value: Math.round(result.total_interest), color: '#fb9d37' },
        ]
      : []

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{t('calc.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('calc.subtitle')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={calculate} className="card space-y-4">
          <Field label={t('calc.useScheme')} hint={t('calc.schemeHint')}>
            <select className="input" value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
              <option value="">{t('calc.noScheme')}</option>
              {(schemesQuery.data ?? []).map((s: Scheme) => (
                <option key={s.id} value={String(s.id)}>{s.scheme_name}</option>
              ))}
            </select>
          </Field>
          <Field label={t('calc.projectCost')}>
            <input className="input" type="number" inputMode="numeric" min={0} value={projectCost} onChange={(e) => setProjectCost(e.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {!selectedScheme && (
              <Field label={t('calc.loanAmount')}>
                <input className="input" type="number" inputMode="numeric" min={0} value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} required />
              </Field>
            )}
            <Field label={t('calc.ownContribution')}>
              <input className="input" type="number" inputMode="numeric" min={0} value={ownContribution} onChange={(e) => setOwnContribution(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('calc.interestRate')}>
              <input className="input" type="number" inputMode="decimal" step="0.1" min={0} max={30} value={interestRate} onChange={(e) => setInterestRate(e.target.value)} disabled={Boolean(selectedScheme)} />
            </Field>
            <Field label={t('calc.tenure')}>
              <input className="input" type="number" inputMode="numeric" min={1} max={30} value={tenure} onChange={(e) => setTenure(e.target.value)} />
            </Field>
            <Field label={t('calc.moratorium')}>
              <input className="input" type="number" inputMode="numeric" min={0} max={120} value={moratorium} onChange={(e) => setMoratorium(e.target.value)} disabled={Boolean(selectedScheme)} />
            </Field>
          </div>

          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            <CalcIcon className="h-4 w-4" aria-hidden="true" />
            {busy ? t('common.loading') : t('calc.calculate')}
          </button>
        </form>

        <div className="space-y-4">
          {result ? (
            <>
              <EMIBreakdownCard breakdown={result} />
              <div className="card">
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <PieChartIcon className="h-5 w-5 text-brand-700" aria-hidden="true" />
                  {t('calc.principalVsInterest')}
                </h2>
                <div className="mt-2 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3} label>
                        {chartData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `₹${value.toLocaleString('en-IN')}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          ) : schemesQuery.isLoading ? (
            <LoadingState />
          ) : (
            <div className="card flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 text-center">
              <div className="p-8 text-slate-400">
                <CalcIcon className="mx-auto h-10 w-10" aria-hidden="true" />
                <p className="mt-3 text-sm">{t('calc.subtitle')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Disclaimer text={t('app.disclaimer')} />
      </div>
    </div>
  )
}