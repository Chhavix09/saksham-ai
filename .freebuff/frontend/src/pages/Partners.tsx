import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FilterX, Layers, List, LocateFixed, Map as MapIcon, Navigation } from 'lucide-react'
import { useT } from '@/i18n'
import { partnersApi, publicApi } from '@/api/endpoints'
import { LoadingState, ErrorState, Disclaimer, Modal } from '@/components/ui'
import { PartnerCard, PartnerDetail, PartnerMap } from '@/components/PartnerComponents'
import type { Partner } from '@/types'

const DEFAULT_CENTER = { lat: 23.0225, lng: 72.5714 } // Ahmedabad demo center

export default function Partners() {
  const { t } = useT()
  const navigate = useNavigate()
  const search = useSearch({ from: '/partners' })
  const schemesQuery = useQuery({ queryKey: ['schemes'], queryFn: publicApi.schemes })

  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locating, setLocating] = useState(false)
  const [radius, setRadius] = useState(50)
  const [schemeId, setSchemeId] = useState<string>(search.scheme ?? '')
  const [partnerType, setPartnerType] = useState('')
  const [selected, setSelected] = useState<Partner | null>(null)
  const [view, setView] = useState<'list' | 'map'>('list')

  const payload = useMemo(
    () => ({
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      scheme_id: schemeId ? Number(schemeId) : undefined,
      radius_km: radius,
      partner_type: partnerType || undefined,
    }),
    [latitude, longitude, schemeId, radius, partnerType],
  )

  const query = useQuery({
    queryKey: ['partners-recommend', payload],
    queryFn: () => partnersApi.recommend(payload),
    enabled: true,
  })

  useEffect(() => {
    if (search.scheme) setSchemeId(search.scheme)
  }, [search.scheme])

  async function locate() {
    if (!navigator.geolocation) return
    setLocating(true)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
      )
      setLatitude(pos.coords.latitude)
      setLongitude(pos.coords.longitude)
    } catch {
      // Fall back to the demo center with a state-wide search
      setLatitude(DEFAULT_CENTER.lat)
      setLongitude(DEFAULT_CENTER.lng)
    } finally {
      setLocating(false)
    }
  }

  const partners = query.data?.partners ?? []
  const excluded = query.data?.excluded ?? []
  const schemeNameMap = useMemo(() => {
    const map = new Map<number, string>()
    for (const s of schemesQuery.data ?? []) map.set(s.id, s.scheme_name)
    return map
  }, [schemesQuery.data])

  const mapPartners = latitude !== null && longitude !== null ? partners : partners

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{t('part.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('part.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={locate} disabled={locating}>
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
            {locating ? t('common.loading') : t('part.nearMe')}
          </button>
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5" role="group" aria-label="View toggle">
            <button
              type="button"
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === 'list' ? 'bg-brand-700 text-white' : 'text-slate-600'}`}
              aria-pressed={view === 'list'}
            >
              <List className="h-4 w-4" aria-hidden="true" />
              {t('part.listTitle')}
            </button>
            <button
              type="button"
              onClick={() => setView('map')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${view === 'map' ? 'bg-brand-700 text-white' : 'text-slate-600'}`}
              aria-pressed={view === 'map'}
            >
              <MapIcon className="h-4 w-4" aria-hidden="true" />
              {t('part.mapTitle')}
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6 grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="label">{t('part.radius')}</span>
          <select className="input" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
            <option value={25}>{t('part.radius.25')}</option>
            <option value={50}>{t('part.radius.50')}</option>
            <option value={100}>{t('part.radius.100')}</option>
          </select>
        </label>
        <label className="block">
          <span className="label">{t('part.schemeFilter')}</span>
          <select className="input" value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {(schemesQuery.data ?? []).map((s) => (
              <option key={s.id} value={String(s.id)}>{s.scheme_name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">{t('admin.type')}</span>
          <select className="input" value={partnerType} onChange={(e) => setPartnerType(e.target.value)}>
            <option value="">{t('common.all')}</option>
            {['SCA', 'PSB', 'RRB', 'NBFC-MFI'].map((type) => (
              <option key={type} value={type}>{t(`part.type.${type}`)}</option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <button type="button" className="btn-ghost w-full" onClick={() => { setSchemeId(''); setPartnerType(''); setRadius(50) }}>
            <FilterX className="h-4 w-4" aria-hidden="true" />
            Clear
          </button>
        </div>
      </div>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState message={t('err.generic')} onRetry={() => query.refetch()} />
      ) : (
        <>
          {view === 'map' ? (
            <div className="card">
              <PartnerMap partners={mapPartners} selectedId={selected?.id} onSelect={setSelected} />
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                {['SCA', 'PSB', 'RRB', 'NBFC-MFI'].map((type) => (
                  <span key={type} className="flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ background: type === 'SCA' ? '#14644d' : type === 'PSB' ? '#1d4ed8' : type === 'RRB' ? '#7c3aed' : '#ea8a1e' }} />
                    {t(`part.type.${type}`)}
                  </span>
                ))}
              </div>
            </div>
          ) : partners.length === 0 ? (
            <div className="card py-12 text-center">
              <Layers className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
              <p className="mt-3 text-sm text-slate-500">{t('part.noPartners')}</p>
              <button type="button" className="btn-primary mt-4" onClick={locate}>
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                {t('part.nearMe')}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {partners.map((partner, index) => (
                <PartnerCard
                  key={partner.id}
                  partner={partner}
                  rank={index + 1}
                  recommended={index === 0}
                  onView={() => setSelected(partner)}
                  onApply={() =>
                    navigate({ to: '/application', search: { scheme: schemeId || undefined, partner: String(partner.id) } })
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {excluded.length > 0 && (
        <section className="mt-8" aria-labelledby="excluded-heading">
          <h2 id="excluded-heading" className="mb-2 text-base font-semibold text-slate-800">
            {t('part.excluded')}
            <span className="ml-2 text-sm font-normal text-slate-400">{t('part.excludedHint')}</span>
          </h2>
          <div className="space-y-2">
            {excluded.slice(0, 6).map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white px-4 py-2.5 text-sm">
                <span className="font-medium text-slate-700">{p.name}</span>
                <span className="text-xs text-slate-500">{p.excluded_reason}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-6">
        <Disclaimer text={t('app.disclaimer')} />
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name ?? ''}>
        {selected && (
          <>
            <PartnerDetail partner={selected} schemes={schemeNameMap} />
            <div className="mt-5 flex flex-wrap gap-2">
              {selected.latitude && selected.longitude && (
                <a
                  className="btn-secondary btn-sm"
                  href={`https://www.openstreetmap.org/directions?to=${selected.latitude}%2C${selected.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Navigation className="h-4 w-4" aria-hidden="true" />
                  {t('part.directions')}
                </a>
              )}
              <Link
                to="/application"
                search={{ scheme: schemeId || undefined, partner: String(selected.id) }}
                className="btn-primary btn-sm"
              >
                {t('rec.startApplication')}
              </Link>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}