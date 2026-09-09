import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Wand2 } from 'lucide-react'
import { useT } from '@/i18n'
import { useAuth } from '@/auth/AuthContext'
import { publicApi, recommendationApi, usersApi } from '@/api/endpoints'
import { LoadingState, ErrorState, Disclaimer, EmptyState } from '@/components/ui'
import { RecommendationCard, ExplanationCard, AlternativeSchemes, NextStepsList } from '@/components/RecommendationComponents'
import type { RecommendationResult } from '@/types'

export default function Recommendations() {
  const { t } = useT()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [sessionResult, setSessionResult] = useState<RecommendationResult | null>(() => {
    try {
      const raw = sessionStorage.getItem('saksham_last_rec')
      return raw ? (JSON.parse(raw) as RecommendationResult) : null
    } catch {
      return null
    }
  })

  // When a guest returns, or after login, fall back to the latest saved recommendation
  const latestQuery = useQuery({
    queryKey: ['latest-recommendation'],
    queryFn: recommendationApi.latest,
    enabled: !sessionResult && Boolean(user),
  })

  const result = sessionResult ?? latestQuery.data ?? null

  useEffect(() => {
    if (latestQuery.data) {
      sessionStorage.setItem('saksham_last_rec', JSON.stringify(latestQuery.data))
      setSessionResult(latestQuery.data)
    }
  }, [latestQuery.data])

  const configQuery = useQuery({ queryKey: ['public-config'], queryFn: publicApi.config })
  const [savedIds, setSavedIds] = useState<number[]>([])
  const [savedBusy, setSavedBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    usersApi.savedSchemes().then((schemes) => setSavedIds(schemes.map((s) => s.id))).catch(() => undefined)
  }, [user])

  async function toggleSave(schemeId: number) {
    if (!user) {
      navigate({ to: '/login', search: { next: '/recommendations' } })
      return
    }
    setSavedBusy(true)
    try {
      if (savedIds.includes(schemeId)) {
        await usersApi.unsaveScheme(schemeId)
        setSavedIds((ids) => ids.filter((id) => id !== schemeId))
      } else {
        await usersApi.saveScheme(schemeId)
        setSavedIds((ids) => [...ids, schemeId])
      }
    } catch {
      // silent: saving is optional
    } finally {
      setSavedBusy(false)
    }
  }

  if (latestQuery.isLoading && !sessionResult) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <LoadingState />
      </div>
    )
  }

  if (!result) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <EmptyState
          title={t('rec.noMatch.title')}
          description={t('rec.noMatch.desc')}
          action={
            <Link to="/onboarding" className="btn-primary">
              <Wand2 className="h-4 w-4" aria-hidden="true" />
              {t('onb.tryDemo')}
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{t('rec.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('rec.subtitle')}</p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={() => navigate({ to: '/onboarding' })}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {t('rec.shareAnother')}
        </button>
      </div>

      <div className="space-y-6">
        <RecommendationCard
          result={result}
          weights={configQuery.data?.recommendation_weights}
          saved={result.recommended_scheme ? savedIds.includes(result.recommended_scheme.id) : false}
          onToggleSave={result.recommended_scheme ? () => toggleSave(result.recommended_scheme!.id) : undefined}
          onCalcEmi={() => navigate({ to: '/calculator' })}
        />

        {result.explanation.length > 0 && (
          <ExplanationCard explanation={result.explanation} weights={configQuery.data?.recommendation_weights} />
        )}

        <NextStepsList steps={result.next_steps} />

        <AlternativeSchemes result={result} />

        <Disclaimer text={configQuery.data?.disclaimer ?? t('app.disclaimer')} />
        <p className="text-center text-xs text-slate-400">{t('app.demoData')}</p>
      </div>
    </div>
  )
}