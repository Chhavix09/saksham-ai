import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Landmark, MapPin, Pencil, Plus, Save, Settings, ShieldCheck, Trash2, Users } from 'lucide-react'
import { useT } from '@/i18n'
import { adminApi, partnersApi, publicApi } from '@/api/endpoints'
import { LoadingState, ErrorState, Modal, Field } from '@/components/ui'
import { INDIAN_STATES, districtsFor } from '@/utils/format'
import type { Partner, Scheme } from '@/types'

type Tab = 'overview' | 'schemes' | 'partners' | 'config' | 'audit'

const STATUS_COLORS: Record<string, string> = {
  not_started: '#94a3b8',
  recommendation_generated: '#0e8f6b',
  documents_pending: '#fb9d37',
  submitted: '#2563eb',
  under_review: '#7c3aed',
  approved: '#16a34a',
  disbursed: '#14644d',
  rejected: '#dc2626',
}

export default function Admin() {
  const { t } = useT()
  const [tab, setTab] = useState<Tab>('overview')
  const [search, setSearch] = useState('')

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 md:text-3xl">
            <ShieldCheck className="h-7 w-7 text-brand-700" aria-hidden="true" />
            {t('admin.title')}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin sections">
          {(
            [
              ['overview', Activity],
              ['schemes', Landmark],
              ['partners', MapPin],
              ['config', Settings],
              ['audit', Users],
            ] as Array<[Tab, typeof Activity]>
          ).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium ${
                tab === key ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-brand-50'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t(`admin.${key}`)}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'schemes' && <SchemesTab search={search} setSearch={setSearch} />}
      {tab === 'partners' && <PartnersTab />}
      {tab === 'config' && <ConfigTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  )
}

/* ------------------------------------------------------------------ overview */
function OverviewTab() {
  const { t } = useT()
  const analytics = useQuery({ queryKey: ['admin-analytics'], queryFn: adminApi.analytics })

  if (analytics.isLoading) return <LoadingState />
  if (analytics.isError) return <ErrorState message={t('err.generic')} onRetry={() => analytics.refetch()} />

  const data = analytics.data!
  const cards = [
    { icon: Users, label: t('admin.totalUsers'), value: data.total_users },
    { icon: Activity, label: t('admin.recommendations'), value: data.total_recommendations },
    { icon: Landmark, label: t('admin.applications'), value: data.total_applications },
    { icon: ShieldCheck, label: t('admin.conversion'), value: `${data.conversion_rate}%` },
  ]

  const statusData = Object.entries(data.applications_by_status).map(([status, count]) => ({
    name: t(`appl.status.${status}`),
    value: count,
    color: STATUS_COLORS[status] ?? '#94a3b8',
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="card">
              <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{card.value}</div>
              <div className="text-xs font-medium text-slate-500">{card.label}</div>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">{t('admin.topSchemes')}</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top_schemes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="scheme_name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0e8f6b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">{t('admin.applicationsByStatus')}</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {statusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">{t('admin.topDistricts')}</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top_districts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="district" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ea8a1e" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">{t('admin.partnerUtilization')}</h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.partner_utilization.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={70} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Bar dataKey="utilization" radius={[6, 6, 0, 0]}>
                  {data.partner_utilization.slice(0, 10).map((p) => (
                    <Cell key={p.name} fill={p.utilization > 85 ? '#dc2626' : p.utilization > 70 ? '#fb9d37' : '#0e8f6b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ schemes */
const EMPTY_SCHEME = {
  scheme_name: '',
  category: 'micro_finance',
  description: '',
  minimum_income: null,
  maximum_income: null,
  minimum_loan: 0,
  maximum_loan: 500000,
  interest_rate: 7.0,
  margin_percentage: 10,
  moratorium_months: 0,
  maximum_tenure_months: 60,
  eligible_purposes: ['start_business'],
  eligible_education_types: [],
  required_documents: ['identity_proof', 'address_proof', 'income_certificate', 'project_documents', 'bank_details'],
  active: true,
}

function SchemesTab({ search, setSearch }: { search: string; setSearch: (s: string) => void }) {
  const { t } = useT()
  const qc = useQueryClient()
  const schemesQuery = useQuery({ queryKey: ['schemes'], queryFn: publicApi.schemes })
  const [editing, setEditing] = useState<Partial<Scheme> | null>(null)
  const [open, setOpen] = useState(false)

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing?.id ? adminApi.updateScheme(editing.id, payload) : adminApi.createScheme(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schemes'] })
      qc.invalidateQueries({ queryKey: ['public-stats'] })
      setOpen(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteScheme(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schemes'] }),
  })

  const filtered = (schemesQuery.data ?? []).filter(
    (s) => s.scheme_name.toLowerCase().includes(search.toLowerCase()) || s.category.includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input className="input max-w-xs" placeholder={t('admin.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} aria-label={t('admin.searchPlaceholder')} />
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => {
            setEditing({ ...EMPTY_SCHEME } as Partial<Scheme>)
            setOpen(true)
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('admin.addScheme')}
        </button>
      </div>

      {schemesQuery.isLoading ? (
        <LoadingState />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">{t('admin.schemeName')}</th>
                <th className="px-3 py-2">{t('admin.category')}</th>
                <th className="px-3 py-2">{t('admin.maxLoan')}</th>
                <th className="px-3 py-2">{t('admin.interestRate')}</th>
                <th className="px-3 py-2">{t('admin.active')}</th>
                <th className="px-3 py-2">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-slate-800">{s.scheme_name}</td>
                  <td className="px-3 py-2.5">{t(`scheme.category.${s.category}`)}</td>
                  <td className="px-3 py-2.5">{s.maximum_loan.toLocaleString('en-IN')}</td>
                  <td className="px-3 py-2.5">{s.interest_rate}%</td>
                  <td className="px-3 py-2.5">
                    <span className={s.active ? 'badge-green' : 'badge-red'}>{s.active ? t('common.yes') : t('common.no')}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button type="button" className="btn-ghost btn-sm" aria-label={t('admin.editScheme')} onClick={() => { setEditing({ ...s }); setOpen(true) }}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                        aria-label={t('admin.delete')}
                        onClick={() => {
                          if (window.confirm(t('admin.confirmDelete'))) deleteMutation.mutate(s.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing?.id ? t('admin.editScheme') : t('admin.addScheme')} wide>
        {editing && (
          <SchemeForm
            scheme={editing}
            onChange={setEditing}
            onSubmit={() => saveMutation.mutate(editing as unknown as Record<string, unknown>)}
            busy={saveMutation.isPending}
          />
        )}
      </Modal>
    </div>
  )
}

function SchemeForm({ scheme, onChange, onSubmit, busy }: { scheme: Partial<Scheme>; onChange: (s: Partial<Scheme>) => void; onSubmit: () => void; busy: boolean }) {
  const { t } = useT()
  const set = (patch: Partial<Scheme>) => onChange({ ...scheme, ...patch })
  const num = (v: unknown) => (v === null || v === '' || v === undefined ? null : Number(v))
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.schemeName')}>
          <input className="input" value={scheme.scheme_name ?? ''} onChange={(e) => set({ scheme_name: e.target.value })} required />
        </Field>
        <Field label={t('admin.category')}>
          <select className="input" value={scheme.category ?? 'micro_finance'} onChange={(e) => set({ category: e.target.value })}>
            {['micro_finance', 'term_loan', 'educational', 'other'].map((c) => (
              <option key={c} value={c}>{t(`scheme.category.${c}`)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t('admin.description')}>
        <textarea className="input" rows={2} value={scheme.description ?? ''} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={t('admin.minIncome')}>
          <input className="input" type="number" value={scheme.minimum_income ?? ''} onChange={(e) => set({ minimum_income: num(e.target.value) })} />
        </Field>
        <Field label={t('admin.maxIncome')}>
          <input className="input" type="number" value={scheme.maximum_income ?? ''} onChange={(e) => set({ maximum_income: num(e.target.value) })} />
        </Field>
        <Field label={t('admin.minLoan')}>
          <input className="input" type="number" value={scheme.minimum_loan ?? 0} onChange={(e) => set({ minimum_loan: Number(e.target.value) || 0 })} />
        </Field>
        <Field label={t('admin.maxLoan')}>
          <input className="input" type="number" value={scheme.maximum_loan ?? 0} onChange={(e) => set({ maximum_loan: Number(e.target.value) || 0 })} required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={t('admin.interestRate')}>
          <input className="input" type="number" step="0.1" value={scheme.interest_rate ?? 0} onChange={(e) => set({ interest_rate: Number(e.target.value) || 0 })} />
        </Field>
        <Field label={t('admin.margin')}>
          <input className="input" type="number" step="0.1" value={scheme.margin_percentage ?? 0} onChange={(e) => set({ margin_percentage: Number(e.target.value) || 0 })} />
        </Field>
        <Field label={t('admin.moratorium')}>
          <input className="input" type="number" value={scheme.moratorium_months ?? 0} onChange={(e) => set({ moratorium_months: Number(e.target.value) || 0 })} />
        </Field>
        <Field label={t('admin.tenure')}>
          <input className="input" type="number" value={scheme.maximum_tenure_months ?? 60} onChange={(e) => set({ maximum_tenure_months: Number(e.target.value) || 60 })} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={Boolean(scheme.active)} onChange={(e) => set({ active: e.target.checked })} className="h-4 w-4 rounded text-brand-600" />
        {t('admin.active')}
      </label>
      {busy && <LoadingState />}
      <button type="submit" className="btn-primary w-full">
        <Save className="h-4 w-4" aria-hidden="true" />
        {t('common.save')}
      </button>
    </form>
  )
}

/* ------------------------------------------------------------------ partners */
function PartnersTab() {
  const { t } = useT()
  const qc = useQueryClient()
  const partnersQuery = useQuery({ queryKey: ['partners'], queryFn: partnersApi.list })
  const schemesQuery = useQuery({ queryKey: ['schemes'], queryFn: publicApi.schemes })

  const [editing, setEditing] = useState<Partial<Partner> | null>(null)
  const [open, setOpen] = useState(false)

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing?.id ? adminApi.updatePartner(editing.id, payload) : adminApi.createPartner(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners'] })
      setOpen(false)
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deletePartner(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partners'] }),
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => {
            setEditing({ partner_type: 'SCA', latitude: 23.02, longitude: 72.57, is_active: true, fund_utilization_percent: 50, processing_status: 'available', npa_indicator: 'none', supported_scheme_ids: [] })
            setOpen(true)
          }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('admin.addPartner')}
        </button>
      </div>

      {partnersQuery.isLoading ? (
        <LoadingState />
      ) : partnersQuery.isError ? (
        <ErrorState message={t('err.generic')} onRetry={() => partnersQuery.refetch()} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">{t('admin.name')}</th>
                <th className="px-3 py-2">{t('admin.type')}</th>
                <th className="px-3 py-2">{t('admin.state')}</th>
                <th className="px-3 py-2">{t('admin.district')}</th>
                <th className="px-3 py-2">{t('admin.fundUtilization')}</th>
                <th className="px-3 py-2">{t('admin.processingStatus')}</th>
                <th className="px-3 py-2">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(partnersQuery.data ?? []).map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-slate-800">{p.name}</td>
                  <td className="px-3 py-2.5">{p.partner_type}</td>
                  <td className="px-3 py-2.5">{p.state}</td>
                  <td className="px-3 py-2.5">{p.district}</td>
                  <td className="px-3 py-2.5">
                    <span className={p.fund_utilization_percent > 85 ? 'badge-red' : p.fund_utilization_percent > 70 ? 'badge-amber' : 'badge-green'}>
                      {p.fund_utilization_percent}%
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={p.processing_status === 'available' ? 'badge-green' : p.processing_status === 'limited' ? 'badge-amber' : 'badge-red'}>
                      {p.processing_status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button type="button" className="btn-ghost btn-sm" onClick={() => { setEditing({ ...p }); setOpen(true) }} aria-label={t('admin.editPartner')}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => { if (window.confirm(t('admin.confirmDelete'))) deleteMutation.mutate(p.id) }} aria-label={t('admin.delete')}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing?.id ? t('admin.editPartner') : t('admin.addPartner')} wide>
        {editing && (
          <PartnerForm
            partner={editing}
            schemes={schemesQuery.data ?? []}
            onChange={setEditing}
            onSubmit={() => saveMutation.mutate(editing as unknown as Record<string, unknown>)}
            busy={saveMutation.isPending}
          />
        )}
      </Modal>
    </div>
  )
}

function PartnerForm({ partner, schemes, onChange, onSubmit, busy }: { partner: Partial<Partner>; schemes: Scheme[]; onChange: (p: Partial<Partner>) => void; onSubmit: () => void; busy: boolean }) {
  const { t } = useT()
  const set = (patch: Partial<Partner>) => onChange({ ...partner, ...patch })
  const toggleScheme = (id: number) => {
    const ids = partner.supported_scheme_ids ?? []
    set({ supported_scheme_ids: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id] })
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.name')}>
          <input className="input" value={partner.name ?? ''} onChange={(e) => set({ name: e.target.value })} required />
        </Field>
        <Field label={t('admin.type')}>
          <select className="input" value={partner.partner_type ?? 'SCA'} onChange={(e) => set({ partner_type: e.target.value })}>
            {['SCA', 'PSB', 'RRB', 'NBFC-MFI'].map((type) => (
              <option key={type} value={type}>{t(`part.type.${type}`)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label={t('admin.address')}>
        <input className="input" value={partner.address ?? ''} onChange={(e) => set({ address: e.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('admin.state')}>
          <select className="input" value={partner.state ?? ''} onChange={(e) => set({ state: e.target.value })}>
            <option value="">{t('common.select')}</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label={t('admin.district')}>
          <input className="input" value={partner.district ?? ''} onChange={(e) => set({ district: e.target.value })} />
        </Field>
        <Field label={t('admin.fundUtilization')}>
          <input className="input" type="number" min={0} max={100} value={partner.fund_utilization_percent ?? 0} onChange={(e) => set({ fund_utilization_percent: Number(e.target.value) || 0 })} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t('admin.latitude')}>
          <input className="input" type="number" step="any" value={partner.latitude ?? ''} onChange={(e) => set({ latitude: Number(e.target.value) })} required />
        </Field>
        <Field label={t('admin.longitude')}>
          <input className="input" type="number" step="any" value={partner.longitude ?? ''} onChange={(e) => set({ longitude: Number(e.target.value) })} required />
        </Field>
        <Field label={t('admin.processingStatus')}>
          <select className="input" value={partner.processing_status ?? 'available'} onChange={(e) => set({ processing_status: e.target.value })}>
            <option value="available">{t('part.available')}</option>
            <option value="limited">{t('part.limited')}</option>
            <option value="paused">{t('part.paused')}</option>
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.phone')}>
          <input className="input" value={partner.phone ?? ''} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label={t('admin.email')}>
          <input className="input" type="email" value={partner.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
        </Field>
      </div>
      <Field label={t('admin.supportedSchemes')}>
        <div className="flex flex-wrap gap-2">
          {schemes.map((s) => {
            const selected = (partner.supported_scheme_ids ?? []).includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleScheme(s.id)}
                className={`rounded-xl border-2 px-3 py-1.5 text-xs font-medium ${selected ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600'}`}
                aria-pressed={selected}
              >
                {s.scheme_name}
              </button>
            )
          })}
        </div>
      </Field>
      {busy && <LoadingState />}
      <button type="submit" className="btn-primary w-full">
        <Save className="h-4 w-4" aria-hidden="true" />
        {t('common.save')}
      </button>
    </form>
  )
}

/* ------------------------------------------------------------------ config */
function ConfigTab() {
  const { t } = useT()
  const qc = useQueryClient()
  const configQuery = useQuery({ queryKey: ['admin-config'], queryFn: adminApi.config })
  const [weights, setWeights] = useState<Record<string, number> | null>(null)
  const [pWeights, setPWeights] = useState<Record<string, number> | null>(null)
  const [disclaimer, setDisclaimer] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useMemo(() => {
    if (configQuery.data) {
      setWeights((w) => w ?? configQuery.data.recommendation_weights)
      setPWeights((w) => w ?? configQuery.data.partner_weights)
      setDisclaimer((d) => d ?? configQuery.data.disclaimer)
    }
  }, [configQuery.data])

  const saveMutation = useMutation({
    mutationFn: () =>
      adminApi.updateConfig({
        recommendation_weights: weights,
        partner_weights: pWeights,
        disclaimer: disclaimer ?? '',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['public-config'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  if (configQuery.isLoading) return <LoadingState />
  if (configQuery.isError) return <ErrorState message={t('err.generic')} onRetry={() => configQuery.refetch()} />

  const factorLabels: Record<string, string> = {
    income: 'rec.factor.income',
    purpose: 'rec.factor.purpose',
    loan_amount: 'rec.factor.loan_amount',
    project_cost: 'rec.factor.project_cost',
    education: 'rec.factor.education',
    location: 'rec.factor.location',
  }
  const partnerLabels: Record<string, string> = {
    distance: 'part.distance',
    scheme_compatibility: 'part.compat',
    fund_utilization: 'part.fund',
    processing: 'admin.processingStatus',
    active: 'admin.active',
  }

  const WeightRow = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div className="flex items-center gap-3">
      <span className="w-44 text-sm text-slate-700">{label}</span>
      <input type="range" min={0} max={40} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-brand-700" aria-label={label} />
      <span className="w-10 text-right text-sm font-semibold text-slate-800">{value}%</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-base font-semibold text-slate-900">{t('admin.weights')}</h2>
        <p className="mt-1 text-xs text-slate-400">{t('admin.weightsHint')}</p>
        <div className="mt-4 space-y-3">
          {weights &&
            Object.entries(weights).map(([key, value]) => (
              <WeightRow
                key={key}
                label={t(factorLabels[key] ?? key)}
                value={value}
                onChange={(v) => setWeights({ ...weights, [key]: v })}
              />
            ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-slate-900">{t('admin.partnerWeights')}</h2>
        <div className="mt-4 space-y-3">
          {pWeights &&
            Object.entries(pWeights).map(([key, value]) => (
              <WeightRow
                key={key}
                label={t(partnerLabels[key] ?? key)}
                value={value}
                onChange={(v) => setPWeights({ ...pWeights, [key]: v })}
              />
            ))}
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-slate-900">{t('admin.disclaimer')}</h2>
        <textarea className="input mt-3" rows={4} value={disclaimer ?? ''} onChange={(e) => setDisclaimer(e.target.value)} />
      </div>

      <button type="button" className="btn-primary" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        <Save className="h-4 w-4" aria-hidden="true" />
        {saveMutation.isPending ? t('common.loading') : t('admin.saveWeights')}
      </button>
      {saved && <p className="text-sm font-medium text-green-700">{t('admin.updated')}</p>}
    </div>
  )
}

/* ------------------------------------------------------------------ audit */
function AuditTab() {
  const { t } = useT()
  const logsQuery = useQuery({ queryKey: ['audit-logs'], queryFn: adminApi.auditLogs })
  if (logsQuery.isLoading) return <LoadingState />
  if (logsQuery.isError) return <ErrorState message={t('err.generic')} onRetry={() => logsQuery.refetch()} />
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            <th className="px-3 py-2">{t('admin.auditAction')}</th>
            <th className="px-3 py-2">{t('admin.auditActor')}</th>
            <th className="px-3 py-2">{t('admin.auditTime')}</th>
          </tr>
        </thead>
        <tbody>
          {(logsQuery.data ?? []).map((log) => (
            <tr key={log.id} className="border-b border-slate-50 last:border-0">
              <td className="px-3 py-2.5 font-medium text-slate-800">{log.action}</td>
              <td className="px-3 py-2.5">{log.actor}</td>
              <td className="px-3 py-2.5 text-slate-500">{new Date(log.created_at).toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}