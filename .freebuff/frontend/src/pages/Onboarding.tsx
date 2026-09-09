import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, ArrowRight, Bot, CheckCircle2, GraduationCap, LocateFixed, Sparkles, Wand2 } from 'lucide-react'
import { useT } from '@/i18n'
import { useAuth } from '@/auth/AuthContext'
import { recommendationApi, usersApi } from '@/api/endpoints'
import { Field, Disclaimer, LoadingState } from '@/components/ui'
import { ProgressStepper } from '@/components/Steppers'
import { INDIAN_STATES, districtsFor } from '@/utils/format'
import type { OnboardingProfile, RecommendationResult } from '@/types'


const PURPOSE_OPTIONS = [
  'start_business',
  'expand_business',
  'agriculture',
  'small_enterprise',
  'vehicle_equipment',
  'education',
  'other',
]

const EDUCATION_TYPES = ['undergraduate', 'postgraduate', 'professional', 'vocational', 'engineering', 'medical', 'other']
const EDUCATION_STATUS = ['none', 'tenth', 'twelfth', 'undergraduate', 'graduate', 'postgraduate', 'vocational']
const CATEGORIES = ['general', 'obc', 'sc', 'st', 'ews', 'minority']

const DEMO_PROFILE: OnboardingProfile = {
  age: 31,
  state: 'Gujarat',
  district: 'Ahmedabad',
  income: 350000,
  occupation: 'Small business owner',
  category: 'general',
  education_status: 'graduate',
  purpose: 'start_business',
  project_cost: 1000000,
  existing_business: false,
  expected_monthly_income: 30000,
  required_loan: 900000,
  own_contribution: 100000,
  city: 'Ahmedabad',
  pincode: '380001',
}

export default function Onboarding() {
  const { t } = useT()
  const navigate = useNavigate()
  const { user, setUser } = useAuth()

  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState<OnboardingProfile>({})
  const [busy, setBusy] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Education flow skips the project-details step
  const steps = useMemo(() => {
    if (profile.purpose === 'education') return ['onb.step1', 'onb.step2', 'onb.step4', 'onb.step5']
    return ['onb.step1', 'onb.step2', 'onb.step3', 'onb.step5']
  }, [profile.purpose])

  const set = (patch: Partial<OnboardingProfile>) => setProfile((p) => ({ ...p, ...patch }))

  const stepKey = steps[step]

  function useDemo() {
    setProfile({ ...DEMO_PROFILE })
    setStep(0)
    setError(null)
  }

  function canProceed(): boolean {
    switch (stepKey) {
      case 'onb.step1':
        return Boolean(profile.age && profile.state && profile.district && profile.income !== undefined && profile.income > 0)
      case 'onb.step2':
        return Boolean(profile.purpose)
      case 'onb.step3':
        return Boolean(profile.project_cost && profile.project_cost > 0)
      case 'onb.step4':
        return Boolean(profile.education_type && profile.tuition_cost && profile.tuition_cost > 0)
      default:
        return true
    }
  }

  async function geolocate() {
    if (!navigator.geolocation) {
      setError(t('err.generic'))
      return
    }
    setLocating(true)
    setError(null)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 }),
      )
      set({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
    } catch {
      setError(t('err.generic'))
    } finally {
      setLocating(false)
    }
  }

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const payload: OnboardingProfile = {
        income: profile.income ?? 0,
        project_cost: profile.purpose === 'education' ? (profile.tuition_cost ?? 0) + (profile.other_education_expenses ?? 0) : (profile.project_cost ?? 0),
        purpose: profile.purpose ?? 'other',
        required_loan: profile.required_loan,
        own_contribution: profile.own_contribution,
        education_status: profile.education_status,
        education_type: profile.purpose === 'education' ? profile.education_type : undefined,
        course: profile.purpose === 'education' ? profile.course : undefined,
        age: profile.age,
        location: {
          state: profile.state ?? '',
          district: profile.district ?? '',
          city: profile.city,
          pincode: profile.pincode,
          latitude: profile.latitude,
          longitude: profile.longitude,
        },
      }

      const result = await recommendationApi.create(payload)

      // Save recommendation for guests and logged-in users alike
      sessionStorage.setItem('saksham_last_rec', JSON.stringify(result))

      // Update the user profile with onboarding details
      if (user) {
        usersApi
          .updateMe({
            age: profile.age,
            state: profile.state,
            district: profile.district,
            annual_income: profile.income,
            occupation: profile.occupation,
            category: profile.category,
            education_status: profile.education_status,
          })
          .then((updated) => setUser(updated))
          .catch(() => undefined)
      }

      navigate({ to: '/recommendations' })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('err.generic'))
    } finally {
      setBusy(false)
    }
  }

  const purposeIcon = (purpose: string) => (purpose === 'education' ? GraduationCap : Sparkles)

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{t('onb.title')}</h1>
        <p className="mt-1.5 text-sm text-slate-500">{t('onb.subtitle')}</p>
        <button type="button" onClick={useDemo} className="btn-saffron mt-4">
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          {t('onb.tryDemo')}
        </button>
      </div>

      <div className="mb-6">
        <ProgressStepper steps={steps.map((k) => t(k))} current={step} />
      </div>

      <form
        className="card fade-up"
        onSubmit={(e) => {
          e.preventDefault()
          if (step < steps.length - 1) setStep((s) => s + 1)
          else void submit()
        }}
      >
        {/* Step 1 – About you */}
        {stepKey === 'onb.step1' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('onb.step1')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onb.age')}>
                <input className="input" type="number" inputMode="numeric" min={15} max={100} value={profile.age ?? ''} onChange={(e) => set({ age: Number(e.target.value) || undefined })} placeholder={t('onb.age.ph')} />
              </Field>
              <Field label={t('onb.income')}>
                <input className="input" type="number" inputMode="numeric" min={0} value={profile.income ?? ''} onChange={(e) => set({ income: Number(e.target.value) || undefined })} placeholder={t('onb.income.ph')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onb.state')}>
                <select className="input" value={profile.state ?? ''} onChange={(e) => set({ state: e.target.value, district: undefined })}>
                  <option value="">{t('common.select')}</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('onb.district')}>
                <select className="input" value={profile.district ?? ''} onChange={(e) => set({ district: e.target.value })} disabled={!profile.state}>
                  <option value="">{t('common.select')}</option>
                  {districtsFor(profile.state).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onb.occupation')}>
                <input className="input" value={profile.occupation ?? ''} onChange={(e) => set({ occupation: e.target.value })} />
              </Field>
              <Field label={t('onb.category')}>
                <select className="input" value={profile.category ?? ''} onChange={(e) => set({ category: e.target.value })}>
                  <option value="">{t('common.select')}</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{t(`onb.category.${c}`)}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t('onb.educationStatus')}>
              <select className="input" value={profile.education_status ?? ''} onChange={(e) => set({ education_status: e.target.value })}>
                <option value="">{t('common.select')}</option>
                {EDUCATION_STATUS.map((s) => (
                  <option key={s} value={s}>{t(`onb.education.${s}`)}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {/* Step 2 – Requirement */}
        {stepKey === 'onb.step2' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('onb.purpose.title')}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {PURPOSE_OPTIONS.map((purpose) => {
                const Icon = purposeIcon(purpose)
                const selected = profile.purpose === purpose
                return (
                  <button
                    key={purpose}
                    type="button"
                    onClick={() => set({ purpose })}
                    className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
                      selected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-200'
                    }`}
                    aria-pressed={selected}
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${selected ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-slate-800">{t(`onb.purpose.${purpose}`)}</span>
                    {selected && <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Step 3 – Project details */}
        {stepKey === 'onb.step3' && profile.purpose !== 'education' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('onb.step3')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onb.projectCost')}>
                <input className="input" type="number" inputMode="numeric" min={0} value={profile.project_cost ?? ''} onChange={(e) => set({ project_cost: Number(e.target.value) || undefined })} placeholder={t('onb.projectCost.ph')} />
              </Field>
              <Field label={t('onb.expectedIncome')}>
                <input className="input" type="number" inputMode="numeric" min={0} value={profile.expected_monthly_income ?? ''} onChange={(e) => set({ expected_monthly_income: Number(e.target.value) || undefined })} placeholder={t('onb.expectedIncome.ph')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onb.requiredLoan')}>
                <input className="input" type="number" inputMode="numeric" min={0} value={profile.required_loan ?? ''} onChange={(e) => set({ required_loan: Number(e.target.value) || undefined })} placeholder={t('onb.requiredLoan.ph')} />
              </Field>
              <Field label={t('onb.ownContribution')}>
                <input className="input" type="number" inputMode="numeric" min={0} value={profile.own_contribution ?? ''} onChange={(e) => set({ own_contribution: Number(e.target.value) || undefined })} placeholder={t('onb.ownContribution.ph')} />
              </Field>
            </div>
            <Field label={t('onb.existingBusiness')}>
              <div className="flex gap-3">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => set({ existing_business: val })}
                    className={`flex-1 rounded-xl border-2 p-3 text-sm font-medium ${
                      profile.existing_business === val ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600'
                    }`}
                    aria-pressed={profile.existing_business === val}
                  >
                    {val ? t('common.yes') : t('common.no')}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        )}

        {/* Step 4 – Education */}
        {stepKey === 'onb.step4' && profile.purpose === 'education' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('onb.needEducationInfo')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onb.educationType')}>
                <select className="input" value={profile.education_type ?? ''} onChange={(e) => set({ education_type: e.target.value })}>
                  <option value="">{t('common.select')}</option>
                  {EDUCATION_TYPES.map((et) => (
                    <option key={et} value={et}>{t(`onb.educationType.${et}`)}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('onb.institutionType')}>
                <select className="input" value={profile.institution_type ?? ''} onChange={(e) => set({ institution_type: e.target.value })}>
                  <option value="">{t('common.select')}</option>
                  {['government', 'private', 'recognized'].map((it) => (
                    <option key={it} value={it}>{t(`onb.institutionType.${it}`)}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onb.course')}>
                <input className="input" value={profile.course ?? ''} onChange={(e) => set({ course: e.target.value })} placeholder={t('onb.course.ph')} />
              </Field>
              <Field label={t('onb.courseDuration')}>
                <input className="input" type="number" inputMode="numeric" min={1} max={8} value={profile.course_duration ?? ''} onChange={(e) => set({ course_duration: e.target.value })} placeholder={t('onb.courseDuration.ph')} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onb.tuitionCost')}>
                <input className="input" type="number" inputMode="numeric" min={0} value={profile.tuition_cost ?? ''} onChange={(e) => set({ tuition_cost: Number(e.target.value) || undefined })} placeholder={t('onb.tuitionCost.ph')} />
              </Field>
              <Field label={t('onb.otherExpenses')}>
                <input className="input" type="number" inputMode="numeric" min={0} value={profile.other_education_expenses ?? ''} onChange={(e) => set({ other_education_expenses: Number(e.target.value) || undefined })} placeholder={t('onb.otherExpenses.ph')} />
              </Field>
            </div>
            <Field label={t('onb.requiredLoan')}>
              <input className="input" type="number" inputMode="numeric" min={0} value={profile.required_loan ?? ''} onChange={(e) => set({ required_loan: Number(e.target.value) || undefined })} placeholder={t('onb.requiredLoan.ph')} />
            </Field>
          </div>
        )}

        {/* Step 5 – Location */}
        {stepKey === 'onb.step5' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">{t('onb.step5')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onb.state')}>
                <select className="input" value={profile.state ?? ''} onChange={(e) => set({ state: e.target.value, district: undefined })}>
                  <option value="">{t('common.select')}</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label={t('onb.district')}>
                <select className="input" value={profile.district ?? ''} onChange={(e) => set({ district: e.target.value })} disabled={!profile.state}>
                  <option value="">{t('common.select')}</option>
                  {districtsFor(profile.state).map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onb.city')}>
                <input className="input" value={profile.city ?? ''} onChange={(e) => set({ city: e.target.value })} placeholder={t('onb.city.ph')} />
              </Field>
              <Field label={t('onb.pincode')}>
                <input className="input" type="text" inputMode="numeric" maxLength={6} value={profile.pincode ?? ''} onChange={(e) => set({ pincode: e.target.value.replace(/\D/g, '') })} placeholder={t('onb.pincode.ph')} />
              </Field>
            </div>
            <div>
              <button type="button" className="btn-secondary w-full" onClick={geolocate} disabled={locating}>
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
                {locating ? t('common.loading') : t('onb.useLocation')}
              </button>
              {profile.latitude && profile.longitude && (
                <p className="mt-2 text-center text-xs text-brand-700">
                  {profile.latitude.toFixed(4)}, {profile.longitude.toFixed(4)}
                </p>
              )}
            </div>
          </div>
        )}

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className="btn-ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('common.back')}
          </button>
          {step < steps.length - 1 ? (
            <button type="submit" className="btn-primary" disabled={!canProceed()}>
              {t('common.next')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button type="submit" className="btn-saffron" disabled={busy || !canProceed()}>
              {busy ? <><Bot className="h-4 w-4 animate-pulse" /> {t('common.loading')}</> : <>{t('onb.getRecommendation')}<ArrowRight className="h-4 w-4" /></>}
            </button>
          )}
        </div>
      </form>

      {busy && <div className="mt-4"><LoadingState label={t('common.loading')} /></div>}

      <div className="mt-6">
        <Disclaimer text={t('app.disclaimer')} />
      </div>
    </div>
  )
}