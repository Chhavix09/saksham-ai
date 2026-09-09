import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Sparkles, UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useT } from '@/i18n'
import { SUPPORTED_LANGUAGES } from '@/i18n'
import { Field, Disclaimer } from '@/components/ui'
import { INDIAN_STATES, districtsFor } from '@/utils/format'

export default function Register() {
  const { t } = useT()
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    full_name: '',
    mobile: '',
    email: '',
    password: '',
    state: '',
    district: '',
    preferred_language: 'en',
    user_type: 'entrepreneur',
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await register(form)
      navigate({ to: '/onboarding' })
    } catch (err) {
      setError(err instanceof Error ? err.message : t('err.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="mb-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-white">
          <Sparkles className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">{t('auth.register.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('auth.register.subtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4">
        <Field label={t('auth.register.fullName')}>
          <input className="input" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} required minLength={2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('auth.register.mobile')}>
            <input className="input" type="tel" inputMode="numeric" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} required minLength={10} maxLength={15} />
          </Field>
          <Field label={t('auth.register.email')}>
            <input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
          </Field>
        </div>
        <Field label={t('auth.register.password')}>
          <input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={8} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('auth.register.state')}>
            <select className="input" value={form.state} onChange={(e) => set('state', e.target.value)}>
              <option value="">{t('common.select')}</option>
              {INDIAN_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label={t('auth.register.district')}>
            <select className="input" value={form.district} onChange={(e) => set('district', e.target.value)} disabled={!form.state}>
              <option value="">{t('common.select')}</option>
              {districtsFor(form.state).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('auth.register.language')}>
            <select className="input" value={form.preferred_language} onChange={(e) => set('preferred_language', e.target.value)}>
              {SUPPORTED_LANGUAGES.map((code) => (
                <option key={code} value={code}>
                  {code === 'en' ? 'English' : code}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('auth.register.userType')}>
            <select className="input" value={form.user_type} onChange={(e) => set('user_type', e.target.value)}>
              <option value="entrepreneur">{t('auth.register.type.entrepreneur')}</option>
              <option value="student">{t('auth.register.type.student')}</option>
              <option value="applicant">{t('auth.register.type.applicant')}</option>
            </select>
          </Field>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {busy ? t('common.loading') : t('auth.register.submit')}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          {t('nav.login')}
        </Link>
      </p>
      <div className="mt-4">
        <Disclaimer text={t('app.disclaimer')} />
      </div>
    </div>
  )
}