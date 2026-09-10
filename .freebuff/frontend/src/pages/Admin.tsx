import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Bot, ClipboardList, Database, Landmark, MapPin, MessageSquare, Pencil, Plus, RefreshCw, Save, ScrollText, Settings, ShieldCheck, Trash2, TrendingUp, Users, Zap } from 'lucide-react'
import { useT } from '@/i18n'
import { useAuth } from '@/auth/AuthContext'
import { adminApi, partnersApi, publicApi } from '@/api/endpoints'
import type { AdminUserRow, AdminUsersResponse } from '@/api/endpoints'
import { LoadingState, ErrorState, Modal, Field, ConfirmDialog } from '@/components/ui'
import { FadeIn } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'
import { INDIAN_STATES, districtsFor, formatINRShort } from '@/utils/format'
import type { Partner, Scheme } from '@/types'

type Tab = 'overview' | 'schemes' | 'partners' | 'applications' | 'users' | 'system' | 'config' | 'audit'

const TAB_ITEMS: Array<[Tab, typeof Activity]> = [
  ['overview', Activity],
  ['schemes', Landmark],
  ['partners', MapPin],
  ['applications', ClipboardList],
  ['users', Users],
  ['system', Bot],
  ['config', Settings],
  ['audit', ScrollText],
]

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
    <div className="mx-auto max-w-6xl px-4 py-8 lg:py-10">
      {/* Sidebar (lg+) + heading row shared by both layouts */}
      <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            <div className="mb-4 flex items-center gap-2.5 px-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{t('admin.layout')}</p>
                <p className="truncate text-[11px] text-slate-400">{t('admin.layoutDesc')}</p>
              </div>
            </div>
            {TAB_ITEMS.map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={tab === key ? 'page' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                  tab === key
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-brand-50 hover:text-brand-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {t(`admin.${key}`)}
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 md:text-3xl">
                <ShieldCheck className="h-7 w-7 text-brand-700 lg:hidden" aria-hidden="true" />
                {t('admin.title')}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {tab === 'applications' ? t('admin.applicationsListDesc') : t('app.tagline')}
              </p>
            </div>
            {/* Mobile / tablet tab pills */}
            <div className="flex flex-wrap gap-2 lg:hidden" role="tablist" aria-label="Admin sections">
              {TAB_ITEMS.map(([key, Icon]) => (
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


          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {tab === 'overview' && <OverviewTab />}
              {tab === 'schemes' && <SchemesTab search={search} setSearch={setSearch} />}
              {tab === 'partners' && <PartnersTab />}
              {tab === 'applications' && <ApplicationsTab />}
              {tab === 'users' && <UsersTab />}
              {tab === 'system' && <SystemTab />}
              {tab === 'config' && <ConfigTab />}
              {tab === 'audit' && <AuditTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
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
    { icon: ShieldCheck, label: t('admin.activeUsers'), value: data.active_users },
    { icon: TrendingUp, label: t('admin.newWeek'), value: data.new_users_week },
    { icon: Landmark, label: t('admin.schemesActive'), value: `${data.active_schemes}/${data.total_schemes}` },
    { icon: Activity, label: t('admin.recommendations'), value: data.total_recommendations },
    { icon: ClipboardList, label: t('admin.applicationsInitiated'), value: data.total_applications },
    { icon: Zap, label: t('admin.aiChatsWeek'), value: data.ai_chats_week },
    { icon: Bot, label: t('admin.conversion'), value: `${data.conversion_rate}%` },
  ]

  const statusData = Object.entries(data.applications_by_status).map(([status, count]) => ({
    name: t(`appl.status.${status}`),
    value: count,
    color: STATUS_COLORS[status] ?? '#94a3b8',
  }))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((card, i) => {
          const Icon = card.icon
          return (
            <FadeIn key={card.label} delay={i * 0.04} className="card">
              <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <div className="kpi-value mt-2">{card.value}</div>
              <div className="kpi-label">{card.label}</div>
            </FadeIn>
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
  const { toast } = useToast()
  const qc = useQueryClient()
  const schemesQuery = useQuery({ queryKey: ['schemes'], queryFn: publicApi.schemes })
  const [editing, setEditing] = useState<Partial<Scheme> | null>(null)
  const [open, setOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Scheme | null>(null)

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing?.id ? adminApi.updateScheme(editing.id, payload) : adminApi.createScheme(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schemes'] })
      qc.invalidateQueries({ queryKey: ['public-stats'] })
      setOpen(false)
      setEditing(null)
      toast(editing?.id ? t('admin.schemeUpdated') : t('admin.schemeCreated'))
    },
    onError: () => toast(t('err.generic'), 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteScheme(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schemes'] })
      toast(t('admin.schemeDeleted'))
      setPendingDelete(null)
    },
    onError: () => toast(t('err.generic'), 'error'),
  })

  const scraperQuery = useQuery({ queryKey: ['scraper-status'], queryFn: adminApi.scraperStatus, refetchInterval: 15000 })

  const syncMutation = useMutation({
    mutationFn: () => adminApi.triggerScraper(),
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['schemes'] })
      qc.invalidateQueries({ queryKey: ['scraper-status'] })
      qc.invalidateQueries({ queryKey: ['public-stats'] })
      toast(`Government schemes sync complete! ${data?.result?.persisted_count ?? 'All'} schemes synchronized.`)
    },
    onError: (err: any) => toast(err?.message || t('err.generic'), 'error'),
  })

  const filtered = (schemesQuery.data ?? []).filter(
    (s) => s.scheme_name.toLowerCase().includes(search.toLowerCase()) || s.category.includes(search.toLowerCase()),
  )

  const sched = scraperQuery.data?.scheduler
  const dbStats = scraperQuery.data?.database_stats

  return (
    <div className="space-y-4">
      {/* 24-Hour Auto-Sync Status Card */}
      <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-teal-50/50 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
              <h3 className="text-base font-semibold text-slate-900">
                24-Hour Government Schemes Sync Engine
              </h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                Active • 24h Recurring
              </span>
            </div>
            <p className="text-xs text-slate-600">
              Continuously monitors and auto-updates schemes every 24 hours from 9 official government portals.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
              className="btn bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-sm flex items-center gap-2 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              {syncMutation.isPending ? 'Syncing 9 Portals...' : 'Sync Schemes Now'}
            </button>
          </div>
        </div>

        {/* Sync metrics & sources */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 border-t border-emerald-100/80 pt-3 text-xs">
          <div>
            <span className="text-slate-500 font-medium">Active Schemes</span>
            <div className="text-sm font-bold text-slate-800">{dbStats?.active_schemes ?? schemesQuery.data?.length ?? 0} Live</div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Last Sync Run</span>
            <div className="text-sm font-bold text-slate-800">
              {sched?.last_run ? new Date(sched.last_run).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently completed'}
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Next Scheduled Check</span>
            <div className="text-sm font-bold text-slate-800">
              {sched?.seconds_until_next_run ? `In ~${Math.round(sched.seconds_until_next_run / 3600)}h` : 'Within 24 hours'}
            </div>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Monitored Portals</span>
            <div className="text-sm font-bold text-emerald-700">9 National Portals</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 pt-1">
          {[
            'myScheme.gov.in',
            'DBT Bharat',
            'scholarships.gov.in (NSP)',
            'education.gov.in (MoE)',
            'MSME Portal',
            'Rural Development',
            'Social Justice & Empowerment',
            'National Portal India',
            'DOSJE Services',
          ].map((p) => (
            <span key={p} className="inline-flex items-center rounded-md bg-white/90 border border-slate-200/60 px-2 py-0.5 text-[11px] font-medium text-slate-600 shadow-xs">
              ✓ {p}
            </span>
          ))}
        </div>
      </div>

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
                        onClick={() => setPendingDelete(s)}
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('admin.delete')}
        message={`${t('admin.confirmDelete')} (${pendingDelete?.scheme_name ?? ''})`}
        confirmLabel={t('common.delete')}
        danger
        busy={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
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
  const { toast } = useToast()
  const qc = useQueryClient()
  const partnersQuery = useQuery({ queryKey: ['partners'], queryFn: partnersApi.list })
  const schemesQuery = useQuery({ queryKey: ['schemes'], queryFn: publicApi.schemes })

  const [editing, setEditing] = useState<Partial<Partner> | null>(null)
  const [open, setOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Partner | null>(null)

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      editing?.id ? adminApi.updatePartner(editing.id, payload) : adminApi.createPartner(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners'] })
      setOpen(false)
      setEditing(null)
      toast(editing?.id ? t('admin.partnerUpdated') : t('admin.partnerCreated'))
    },
    onError: () => toast(t('err.generic'), 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deletePartner(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partners'] })
      toast(t('admin.partnerDeleted'))
      setPendingDelete(null)
    },
    onError: () => toast(t('err.generic'), 'error'),
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
                      <button type="button" className="btn-ghost btn-sm text-red-600 hover:bg-red-50" onClick={() => setPendingDelete(p)} aria-label={t('admin.delete')}>
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

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('admin.delete')}
        message={`${t('admin.confirmDelete')} (${pendingDelete?.name ?? ''})`}
        confirmLabel={t('common.delete')}
        danger
        busy={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
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

/* -------------------------------------------------------------- applications */
const APPLICATION_STATUSES = [
  'not_started',
  'recommendation_generated',
  'documents_pending',
  'submitted',
  'under_review',
  'approved',
  'disbursed',
  'rejected',
] as const

function ApplicationsTab() {
  const { t } = useT()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [statusTarget, setStatusTarget] = useState<{ id: number; status: string; label: string } | null>(null)

  const appsQuery = useQuery({
    queryKey: ['admin-applications', status, search],
    queryFn: () => adminApi.applications({ status, search }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status: next }: { id: number; status: string }) => adminApi.setApplicationStatus(id, next),
    onSuccess: () => {
      toast(t('admin.statusUpdated'))
      qc.invalidateQueries({ queryKey: ['admin-applications'] })
      qc.invalidateQueries({ queryKey: ['admin-analytics'] })
      setStatusTarget(null)
    },
    onError: (err) => toast(err instanceof Error ? err.message : t('err.generic'), 'error'),
  })

  const data = appsQuery.data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs flex-1"
          placeholder={t('admin.userSearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('admin.userSearch')}
        />
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('admin.statusCol')}>
          <option value="">{t('admin.statusCol')}: {t('common.all')}</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>{t(`appl.status.${s}`)}</option>
          ))}
        </select>
        {data && <span className="ml-auto text-sm text-slate-500">{data.total}</span>}
      </div>

      {appsQuery.isLoading ? (
        <LoadingState />
      ) : appsQuery.isError ? (
        <ErrorState message={t('err.generic')} onRetry={() => appsQuery.refetch()} />
      ) : (data?.applications.length ?? 0) === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-500">{t('admin.noApplications')}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="th">{t('admin.applicant')}</th>
                <th className="th">{t('admin.schemeCol')}</th>
                <th className="th">{t('admin.partnerCol')}</th>
                <th className="th">{t('admin.loanCol')}</th>
                <th className="th">{t('admin.docsCol')}</th>
                <th className="th">{t('admin.updatedCol')}</th>
                <th className="th">{t('admin.statusCol')}</th>
              </tr>
            </thead>
            <tbody>
              {data!.applications.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/70">
                  <td className="td">
                    <div className="font-medium text-slate-800">{a.applicant}</div>
                    <div className="text-xs text-slate-400">{a.email ?? '—'}</div>
                  </td>
                  <td className="td font-medium text-slate-800">{a.scheme_name ?? '—'}</td>
                  <td className="td text-slate-600">{a.partner_name ?? '—'}</td>
                  <td className="td text-slate-600">{a.loan_amount != null ? formatINRShort(a.loan_amount) : '—'}</td>
                  <td className="td text-slate-600">{a.documents_provided}/{a.documents_total}</td>
                  <td className="td text-slate-500">{a.updated_at ? new Date(a.updated_at).toLocaleDateString('en-IN') : '—'}</td>
                  <td className="td">
                    <select
                      className="input w-auto py-1.5 text-xs"
                      value={a.status}
                      aria-label={`${t('admin.statusCol')}: ${a.applicant}`}
                      onChange={(e) => {
                        const next = e.target.value
                        if (next !== a.status) setStatusTarget({ id: a.id, status: next, label: t(`appl.status.${next}`) })
                      }}
                    >
                      {APPLICATION_STATUSES.map((s) => (
                        <option key={s} value={s}>{t(`appl.status.${s}`)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={t('admin.statusCol')}
        message={`${t('admin.applicationsDesc')} (${statusTarget?.label})`}
        confirmLabel={t('common.confirm')}
        busy={statusMutation.isPending}
        onConfirm={() => statusTarget && statusMutation.mutate({ id: statusTarget.id, status: statusTarget.status })}
        onCancel={() => setStatusTarget(null)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ config */
function ConfigTab() {
  const { t } = useT()
  const { toast } = useToast()
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
      toast(t('admin.updated'))
      setTimeout(() => setSaved(false), 3000)
    },
    onError: () => toast(t('err.generic'), 'error'),
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
  const logsQuery = useQuery({ queryKey: ['audit-logs'], queryFn: () => adminApi.auditLogs() })
  if (logsQuery.isLoading) return <LoadingState />
  if (logsQuery.isError) return <ErrorState message={t('err.generic')} onRetry={() => logsQuery.refetch()} />
  const logs = logsQuery.data ?? []
  return (
    <div className="card overflow-x-auto">
      {logs.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">{t('admin.auditEmpty')}</p>
      ) : (
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="th">{t('admin.auditAction')}</th>
              <th className="th">{t('admin.auditEntity')}</th>
              <th className="th">{t('admin.auditDetails')}</th>
              <th className="th">{t('admin.auditActor')}</th>
              <th className="th">{t('admin.auditTime')}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/70 last:border-0">
                <td className="td">
                  <span className="badge-brand">{log.action}</span>
                </td>
                <td className="td text-slate-700">
                  {log.entity_label || (log.entity_id ? `${log.entity_type} #${log.entity_id}` : log.entity_type || '—')}
                </td>
                <td className="td max-w-[16rem] truncate text-xs text-slate-500" title={JSON.stringify(log.details)}>
                  {Object.keys(log.details ?? {}).length > 0 ? JSON.stringify(log.details) : '—'}
                </td>
                <td className="td text-slate-600">{log.actor}</td>
                <td className="td text-slate-500">{new Date(log.created_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ users */
const USER_ROLES = ['applicant', 'entrepreneur', 'student', 'admin'] as const

interface UserAction {
  kind: 'activate' | 'deactivate' | 'role'
  user: AdminUserRow
  role?: string
}

function UsersTab() {
  const { t } = useT()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { user: me } = useAuth()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')
  const [active, setActive] = useState('')
  const [action, setAction] = useState<UserAction | null>(null)

  const usersQuery = useQuery({
    queryKey: ['admin-users', search, role, active],
    queryFn: () => adminApi.users({ search, role, active }),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => adminApi.setUserStatus(id, is_active),
    onSuccess: (res) => {
      toast(res.message || t('admin.userUpdated'))
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['admin-system'] })
      setAction(null)
    },
    onError: (err) => toast(err instanceof Error ? err.message : t('admin.userUpdateFailed'), 'error'),
  })

  const roleMutation = useMutation({
    mutationFn: ({ id, role: next }: { id: number; role: string }) => adminApi.setUserRole(id, next),
    onSuccess: (res) => {
      toast(res.message || t('admin.roleUpdated'))
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setAction(null)
    },
    onError: (err) => toast(err instanceof Error ? err.message : t('admin.userUpdateFailed'), 'error'),
  })

  const data: AdminUsersResponse | undefined = usersQuery.data

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs flex-1"
          placeholder={t('admin.userSearch')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t('admin.userSearch')}
        />
        <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value)} aria-label={t('admin.role')}>
          <option value="">{t('admin.role')}: {t('common.all')}</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select className="input w-auto" value={active} onChange={(e) => setActive(e.target.value)} aria-label={t('admin.active')}>
          <option value="">{t('admin.active')}: {t('common.all')}</option>
          <option value="true">{t('common.yes')}</option>
          <option value="false">{t('common.no')}</option>
        </select>
        {data && <span className="ml-auto text-sm text-slate-500">{data.total}</span>}
      </div>

      {usersQuery.isLoading ? (
        <LoadingState />
      ) : usersQuery.isError ? (
        <ErrorState message={t('err.generic')} onRetry={() => usersQuery.refetch()} />
      ) : (data?.users.length ?? 0) === 0 ? (
        <div className="card py-12 text-center text-sm text-slate-500">{t('admin.noUsers')}</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">{t('admin.name')}</th>
                <th className="px-3 py-2">{t('admin.role')}</th>
                <th className="px-3 py-2">{t('admin.joined')}</th>
                <th className="px-3 py-2 text-center" title={t('admin.recommendations')}>{t('admin.colRecs')}</th>
                <th className="px-3 py-2 text-center" title={t('admin.applicationsInitiated')}>{t('admin.colApps')}</th>
                <th className="px-3 py-2 text-center" title={t('admin.totalChats')}>{t('admin.colChats')}</th>
                <th className="px-3 py-2">{t('admin.active')}</th>
                <th className="px-3 py-2">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {data!.users.map((u: AdminUserRow) => {
                const self = u.id === me?.id
                return (
                  <tr key={u.id} className={`border-b border-slate-50 last:border-0 ${u.is_active ? '' : 'opacity-60'}`}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-slate-800">
                        {u.full_name}
                        {self && <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">{t('admin.you')}</span>}
                      </div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      {self ? (
                        <span className={u.role === 'admin' ? 'badge-amber' : 'badge-green'}>{u.role}</span>
                      ) : (
                        <select
                          className={`input w-auto py-1 text-xs ${u.role === 'admin' ? 'font-semibold' : ''}`}
                          value={u.role}
                          aria-label={`${t('admin.role')}: ${u.full_name}`}
                          onChange={(e) => {
                            const next = e.target.value
                            if (next !== u.role) setAction({ kind: 'role', user: u, role: next })
                          }}
                        >
                          {USER_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-3 py-2.5 text-center">{u.recommendations}</td>
                    <td className="px-3 py-2.5 text-center">{u.applications}</td>
                    <td className="px-3 py-2.5 text-center">{u.chat_messages}</td>
                    <td className="px-3 py-2.5">
                      <span className={u.is_active ? 'badge-green' : 'badge-red'}>{u.is_active ? t('common.yes') : t('common.no')}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        className={`btn-sm ${u.is_active ? 'btn-ghost text-red-600 hover:bg-red-50' : 'btn-primary'}`}
                        disabled={self}
                        title={self ? t('admin.you') : undefined}
                        onClick={() =>
                          setAction({ kind: u.is_active ? 'deactivate' : 'activate', user: u })
                        }
                      >
                        {u.is_active ? t('admin.deactivate') : t('admin.activate')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={action?.kind === 'deactivate'}
        title={t('admin.deactivateTitle')}
        message={`${action?.user.full_name ?? ''} — ${t('admin.deactivateDesc')}`}
        confirmLabel={t('admin.deactivate')}
        danger
        busy={statusMutation.isPending}
        onConfirm={() => action && statusMutation.mutate({ id: action.user.id, is_active: false })}
        onCancel={() => setAction(null)}
      />
      <ConfirmDialog
        open={action?.kind === 'activate'}
        title={t('admin.activateTitle')}
        message={`${action?.user.full_name ?? ''} — ${t('admin.activateDesc')}`}
        confirmLabel={t('admin.activate')}
        busy={statusMutation.isPending}
        onConfirm={() => action && statusMutation.mutate({ id: action.user.id, is_active: true })}
        onCancel={() => setAction(null)}
      />
      <ConfirmDialog
        open={action?.kind === 'role'}
        title={t('admin.roleChangeTitle')}
        message={`${action?.user.full_name ?? ''}: ${action?.user.role} → ${action?.role ?? ''}. ${t('admin.roleChangeDesc')}`}
        confirmLabel={t('admin.changeRole')}
        busy={roleMutation.isPending}
        onConfirm={() => action?.role && roleMutation.mutate({ id: action.user.id, role: action.role })}
        onCancel={() => setAction(null)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ system & AI */
const TOPIC_COLORS: Record<string, string> = {
  schemes: '#0e8f6b',
  partners: '#2563eb',
  how_to: '#7c3aed',
  user_data: '#ea8a1e',
  general: '#94a3b8',
  off_topic: '#dc2626',
}

function SystemTab() {
  const { t } = useT()
  const systemQuery = useQuery({
    queryKey: ['admin-system'],
    queryFn: adminApi.system,
    refetchInterval: 60_000,
  })

  if (systemQuery.isLoading) return <LoadingState />
  if (systemQuery.isError || !systemQuery.data)
    return <ErrorState message={t('err.generic')} onRetry={() => systemQuery.refetch()} />

  const data = systemQuery.data
  const userCards = [
    { icon: Users, label: t('admin.totalUsers'), value: data.users.total },
    { icon: ShieldCheck, label: t('admin.activeUsers'), value: data.users.active },
    { icon: TrendingUp, label: t('admin.newWeek'), value: data.users.new_week },
  ]
  const aiCards = [
    { icon: MessageSquare, label: t('admin.totalChats'), value: data.ai.total_chats },
    { icon: Zap, label: t('admin.chatsToday'), value: data.ai.chats_today },
    { icon: Bot, label: t('admin.llmChats'), value: data.ai.llm_chats },
    { icon: Activity, label: t('admin.fallbackChats'), value: data.ai.fallback_chats },
    { icon: RefreshCw, label: t('admin.failedChats'), value: data.ai.failed_chats },
    {
      icon: Zap,
      label: t('admin.avgLatency'),
      value: data.ai.avg_latency_ms != null ? `${data.ai.avg_latency_ms} ms` : '—',
    },
  ]
  const topicData = data.ai.by_topic.map(({ topic, count }) => ({
    name: topic,
    value: count,
    color: TOPIC_COLORS[topic] ?? '#94a3b8',
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">{t('app.demoData')}</p>
        <button type="button" className="btn-ghost btn-sm" onClick={() => systemQuery.refetch()} aria-label={t('common.retry')}>
          <RefreshCw className={`h-4 w-4 ${systemQuery.isFetching ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {/* Users */}
      <div className="grid grid-cols-3 gap-4">
        {userCards.map((card, i) => {
          const Icon = card.icon
          return (
            <FadeIn key={card.label} delay={i * 0.05} className="card">
              <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <div className="mt-2 text-2xl font-extrabold text-slate-900">{card.value}</div>
              <div className="text-xs font-medium text-slate-500">{card.label}</div>
            </FadeIn>
          )
        })}
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-slate-900">{t('admin.growth')}</h2>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.users.growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0e8f6b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* AI usage */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {aiCards.map((card, i) => {
          const Icon = card.icon
          return (
            <FadeIn key={card.label} delay={i * 0.04} className="card">
              <Icon className="h-5 w-5 text-brand-600" aria-hidden="true" />
              <div className="mt-2 text-xl font-extrabold text-slate-900">{card.value}</div>
              <div className="text-[11px] font-medium leading-tight text-slate-500">{card.label}</div>
            </FadeIn>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-base font-semibold text-slate-900">{t('admin.byTopic')}</h2>
          {topicData.length === 0 ? (
            <p className="mt-6 text-center text-sm text-slate-400">{t('dash.noApplication')}</p>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={topicData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {topicData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Database className="h-4 w-4 text-brand-600" aria-hidden="true" />
            {t('admin.dbHealth')}
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Engine</span>
              <span className="badge-green">{data.database.dialect}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{t('admin.dbLatency')}</span>
              <span className="font-semibold text-slate-800">{data.database.latency_ms != null ? `${data.database.latency_ms} ms` : '—'}</span>
            </div>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">{t('admin.tables')}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.entries(data.database.tables).map(([name, count]) => (
                  <div key={name} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className="text-sm font-bold text-slate-800">{count ?? '—'}</div>
                    <div className="text-[11px] text-slate-400">{name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-base font-semibold text-slate-900">{t('admin.recentRegs')}</h2>
        {data.recent_registrations.length === 0 ? (
          <p className="mt-4 text-center text-sm text-slate-400">{t('admin.noUsers')}</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <tbody>
                {data.recent_registrations.map((u) => (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{u.full_name}</td>
                    <td className="px-3 py-2.5 text-slate-500">{u.email}</td>
                    <td className="px-3 py-2.5">{u.role}</td>
                    <td className="px-3 py-2.5 text-slate-500">{u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-3 py-2.5">
                      <span className={u.is_active ? 'badge-green' : 'badge-red'}>{u.is_active ? t('common.yes') : t('common.no')}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}