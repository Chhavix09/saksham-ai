import { useState } from 'react'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft, Eye, EyeOff, KeyRound, LogIn, Sparkles, UserPlus } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useT } from '@/i18n'
import { authApi } from '@/api/endpoints'
import { Field, Modal, Disclaimer } from '@/components/ui'

export default function Login() {
  const { t } = useT()
  const { login } = useAuth()
  const navigate = useNavigate()
  const search = useSearch({ from: '/login' })

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [forgotOpen, setForgotOpen] = useState(false)
  const [forgotId, setForgotId] = useState('')
  const [forgotMsg, setForgotMsg] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [forgotBusy, setForgotBusy] = useState(false)

  const afterLogin = () => {
    navigate({ to: search.next ?? '/dashboard' })
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(identifier.trim(), password, rememberMe)
      afterLogin()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('err.generic'))
    } finally {
      setBusy(false)
    }
  }

  async function onForgot(e: React.FormEvent) {
    e.preventDefault()
    setForgotBusy(true)
    setForgotMsg(null)
    try {
      const res = await authApi.forgotPassword(forgotId.trim())
      setForgotMsg(res.message)
      if (res.demo_token) setResetToken(res.demo_token)
    } catch (err) {
      setForgotMsg(err instanceof Error ? err.message : t('err.generic'))
    } finally {
      setForgotBusy(false)
    }
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault()
    if (!resetToken) return
    setForgotBusy(true)
    try {
      const res = await authApi.resetPassword(resetToken, newPassword)
      setForgotMsg(res.message)
      setResetToken(null)
      setNewPassword('')
    } catch (err) {
      setForgotMsg(err instanceof Error ? err.message : t('err.generic'))
    } finally {
      setForgotBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-white">
          <Sparkles className="h-7 w-7" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-2xl font-bold text-slate-900">{t('auth.login.title')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('auth.login.subtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="card space-y-4">
        <Field label={t('auth.login.identifier')}>
          <input
            className="input"
            type="text"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t('auth.login.identifier.ph')}
            required
          />
        </Field>
        <Field label={t('auth.login.password')}>
          <div className="relative">
            <input
              className="input pr-11"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.login.password.ph')}
              required
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </Field>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            {t('auth.login.rememberMe')}
          </label>
          <button type="button" className="text-sm font-medium text-brand-700 hover:underline" onClick={() => setForgotOpen(true)}>
            {t('auth.login.forgotPassword')}
          </button>
        </div>

        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {busy ? t('common.loading') : t('auth.login.submit')}
        </button>
      </form>

      <button
        type="button"
        className="btn-secondary mt-4 w-full"
        onClick={() => navigate({ to: '/onboarding' })}
      >
        {t('auth.login.orGuest')}
      </button>

      <p className="mt-6 text-center text-sm text-slate-600">
        {t('auth.login.noAccount')}{' '}
        <Link to="/register" className="font-semibold text-brand-700 hover:underline">
          {t('nav.register')}
        </Link>
      </p>

      <div className="mt-6 rounded-xl bg-brand-50 p-3 text-center text-xs text-brand-900">
        {t('auth.register.demoHint')}
      </div>

      <div className="mt-4">
        <Disclaimer text={t('app.disclaimer')} />
      </div>

      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title={t('auth.forgot.title')}>
        {!resetToken ? (
          <form onSubmit={onForgot} className="space-y-4">
            <p className="text-sm text-slate-600">{t('auth.forgot.subtitle')}</p>
            <Field label={t('auth.login.identifier')}>
              <input className="input" value={forgotId} onChange={(e) => setForgotId(e.target.value)} required />
            </Field>
            {forgotMsg && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{forgotMsg}</p>}
            <button type="submit" disabled={forgotBusy} className="btn-primary w-full">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {forgotBusy ? t('common.loading') : t('auth.forgot.submit')}
            </button>
            <button type="button" className="btn-ghost w-full" onClick={() => setForgotOpen(false)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {t('auth.forgot.back')}
            </button>
          </form>
        ) : (
          <form onSubmit={onReset} className="space-y-4">
            <p className="text-sm text-slate-600">{t('auth.reset.title')}</p>
            <Field label={t('auth.reset.newPassword')}>
              <input
                className="input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </Field>
            {forgotMsg && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{forgotMsg}</p>}
            <button type="submit" disabled={forgotBusy} className="btn-primary w-full">
              {forgotBusy ? t('common.loading') : t('auth.reset.submit')}
            </button>
          </form>
        )}
      </Modal>
    </div>
  )
}