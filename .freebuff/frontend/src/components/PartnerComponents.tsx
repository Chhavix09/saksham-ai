import { useEffect, useState } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Award, Banknote, Building2, Landmark, MapPin, Phone, Star, Users } from 'lucide-react'
import { useT } from '@/i18n'
import type { Partner } from '@/types'

const ICONS: Record<string, L.DivIcon> = {
  SCA: L.divIcon({
    className: '',
    html: '<div style="width:30px;height:30px;border-radius:50%;background:#14644d;border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.3)">★</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  }),
  PSB: L.divIcon({
    className: '',
    html: '<div style="width:30px;height:30px;border-radius:50%;background:#1d4ed8;border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.3)">B</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  }),
  RRB: L.divIcon({
    className: '',
    html: '<div style="width:30px;height:30px;border-radius:50%;background:#7c3aed;border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.3)">R</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  }),
  'NBFC-MFI': L.divIcon({
    className: '',
    html: '<div style="width:30px;height:30px;border-radius:50%;background:#ea8a1e;border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,.3)">M</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  }),
}

function defaultIcon(type: string) {
  return ICONS[type] ?? ICONS.SCA
}

export function typeLabel(type: string): string {
  const map: Record<string, string> = {
    SCA: 'State Channelizing Agency',
    PSB: 'Public Sector Bank',
    RRB: 'Regional Rural Bank',
    'NBFC-MFI': 'NBFC-MFI',
  }
  return map[type] ?? type
}

function TypeIcon({ type }: { type: string }) {
  if (type === 'SCA') return <Landmark className="h-4 w-4" aria-hidden="true" />
  if (type === 'PSB') return <Building2 className="h-4 w-4" aria-hidden="true" />
  if (type === 'RRB') return <Users className="h-4 w-4" aria-hidden="true" />
  return <Banknote className="h-4 w-4" aria-hidden="true" />
}

function statusBadge(partner: Partner) {
  if (partner.processing_status === 'paused') return <span className="badge-red">{partner.processing_label ?? 'Unavailable'}</span>
  if (partner.processing_status === 'limited') return <span className="badge-amber">{partner.processing_label ?? 'Limited'}</span>
  return <span className="badge-green">{partner.processing_label ?? 'Available'}</span>
}

function fundBadge(partner: Partner) {
  if (!partner.fund_health) return null
  const cls = partner.fund_health === 'Healthy' ? 'badge-green' : partner.fund_health === 'Moderate' ? 'badge-amber' : 'badge-red'
  return <span className={cls}>{partner.fund_health}</span>
}

export function PartnerCard({
  partner,
  rank,
  recommended,
  onView,
  onApply,
}: {
  partner: Partner
  rank: number
  recommended?: boolean
  onView: () => void
  onApply?: () => void
}) {
  const { t } = useT()
  return (
    <article
      className={`card fade-up ${recommended ? 'border-2 border-brand-500' : ''}`}
      aria-label={partner.name}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <TypeIcon type={partner.partner_type} />
            {recommended && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-saffron-500 text-white">
                <Star className="h-3 w-3 fill-current" aria-hidden="true" />
              </span>
            )}
          </span>
          <div>
            <h3 className="font-semibold leading-tight text-slate-900">
              {recommended && <span className="mr-1 text-xs font-bold uppercase text-saffron-600">★ {t('part.recommended')}</span>}
              {partner.name}
            </h3>
            <p className="text-xs text-slate-500">
              #{rank} · {t(`part.type.${partner.partner_type}`)}
            </p>
          </div>
        </div>
        {partner.recommendation_score !== undefined && (
          <div className="shrink-0 rounded-xl bg-brand-50 px-3 py-1.5 text-center">
            <div className="text-lg font-bold text-brand-800">{Math.round(partner.recommendation_score)}</div>
            <div className="text-[10px] font-medium text-brand-600">{t('rec.match')}</div>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        {partner.distance_km !== undefined && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
            {partner.distance_km.toFixed(1)} {t('common.km')}
          </span>
        )}
        <span className="text-slate-300">·</span>
        <span className="text-slate-600">
          {partner.city}, {partner.state}
        </span>
        <span className="text-slate-300">·</span>
        {statusBadge(partner)}
        {fundBadge(partner)}
        {partner.npa_indicator !== 'none' && (
          <span className="badge-red">{t(partner.npa_indicator === 'high' ? 'part.npa.high' : 'part.npa.watch')}</span>
        )}
      </div>

      {partner.breakdown && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat label={t('part.distance')} value={`${Math.round(partner.breakdown.distance)}%`} />
          <MiniStat label={t('part.compat')} value={`${Math.round(partner.breakdown.scheme_compatibility)}%`} />
          <MiniStat label={t('part.fund')} value={`${Math.round(partner.breakdown.fund_utilization)}%`} />
          <MiniStat label={t('part.compat')} value={partner.processing_label ?? ''} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={onView}>
          {t('part.viewDetails')}
        </button>
        {onApply && (
          <button type="button" className="btn-primary btn-sm" onClick={onApply}>
            {t('rec.startApplication')}
          </button>
        )}
      </div>
    </article>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-xs font-semibold text-slate-800">{value}</div>
    </div>
  )
}

export function PartnerDetail({ partner, schemes }: { partner: Partner; schemes: Map<number, string> }) {
  const { t } = useT()
  const supported = partner.supported_scheme_ids.map((id) => schemes.get(id)).filter(Boolean)
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TypeIcon type={partner.partner_type} />
        <span className="text-sm font-medium text-slate-600">{t(`part.type.${partner.partner_type}`)}</span>
        {statusBadge(partner)}
      </div>
      <div className="flex items-start gap-2 text-sm text-slate-700">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <span>
          {partner.address}
          <br />
          {partner.city}, {partner.district}, {partner.state} — {partner.pincode}
        </span>
      </div>
      {partner.contact_person && (
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Users className="h-4 w-4 text-slate-400" aria-hidden="true" />
          {partner.contact_person}
        </div>
      )}
      {partner.phone && (
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <Phone className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <a href={`tel:${partner.phone.replace(/\s/g, '')}`} className="text-brand-700 hover:underline">
            {partner.phone}
          </a>
        </div>
      )}
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t('part.supportedSchemes')}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {supported.length ? supported.map((name) => <span key={name} className="badge-brand">{name}</span>) : <span className="text-sm text-slate-500">—</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-xs font-medium text-slate-500">{t('part.fund')}</p>
          <p className="mt-0.5 text-base font-bold text-slate-900">{partner.fund_utilization_percent}%</p>
        </div>
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-xs font-medium text-slate-500">{t('part.distance')}</p>
          <p className="mt-0.5 text-base font-bold text-slate-900">
            {partner.distance_km !== undefined ? `${partner.distance_km.toFixed(1)} km` : '—'}
          </p>
        </div>
      </div>
      {partner.is_demo && <p className="text-xs italic text-slate-400">{t('app.demoData')}</p>}
    </div>
  )
}

function FitMarkers({ points }: { points: Array<[number, number]> }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds.pad(0.3))
  }, [points, map])
  return null
}

export function PartnerMap({ partners, selectedId, onSelect }: { partners: Partner[]; selectedId?: number | null; onSelect?: (p: Partner) => void }) {
  const points = partners.map((p) => [p.latitude, p.longitude] as [number, number])
  const center: [number, number] = points[0] ?? [23.0225, 72.5714]

  return (
    <MapContainer center={center} zoom={points.length > 1 ? 9 : 12} scrollWheelZoom={false} style={{ height: 420 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.length > 1 && <FitMarkers points={points} />}
      {partners.map((p) => (
        <Marker
          key={p.id}
          position={[p.latitude, p.longitude]}
          icon={defaultIcon(p.partner_type)}
          eventHandlers={{ click: () => onSelect?.(p) }}
        >
          <Popup>
            <div className="min-w-[180px] p-1">
              <p className="font-semibold text-slate-900">{p.name}</p>
              <p className="text-xs text-slate-500">
                {p.city}, {p.state}
              </p>
              {p.distance_km !== undefined && <p className="mt-1 text-xs font-medium text-brand-700">{p.distance_km.toFixed(1)} km</p>}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}