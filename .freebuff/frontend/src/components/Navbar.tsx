import { useState } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, LogIn, LogOut, Menu, Sparkles, UserPlus, X } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { useT } from '@/i18n'
import LanguageSelector from '@/components/LanguageSelector'

const links = [
  { to: '/', key: 'nav.home', match: '/' },
  { to: '/onboarding', key: 'nav.findScheme', match: '/onboarding' },
  { to: '/calculator', key: 'nav.calculator', match: '/calculator' },
  { to: '/partners', key: 'nav.partners', match: '/partners' },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const { t } = useT()
  const [open, setOpen] = useState(false)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  const isActive = (match: string) => pathname === match || (match !== '/' && pathname.startsWith(match))

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="Scheme Up home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-white">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold text-brand-900">
            Scheme<span className="text-saffron-500">Up</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.match) ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100 hover:text-brand-800'
              }`}
            >
              {t(link.key)}
            </Link>
          ))}
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/admin') ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t('nav.admin')}
            </Link>
          )}
          {user && (
            <Link
              to="/dashboard"
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/dashboard') ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t('nav.dashboard')}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          {user ? (
            <div className="hidden items-center gap-2 md:flex">
              <span className="max-w-[10rem] truncate text-sm font-medium text-slate-700">{user.full_name}</span>
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                {t('nav.logout')}
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link to="/login" className="btn-ghost flex items-center gap-1.5">
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {t('nav.login')}
              </Link>
              <Link to="/register" className="btn-primary btn-sm">
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                {t('nav.register')}
              </Link>
            </div>
          )}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 md:hidden"
            aria-label={t('nav.menu')}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-slate-100 bg-white px-4 py-3 md:hidden" aria-label="Mobile navigation">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2.5 text-base font-medium ${
                  isActive(link.match) ? 'bg-brand-50 text-brand-800' : 'text-slate-700'
                }`}
              >
                {t(link.key)}
              </Link>
            ))}
            {user?.role === 'admin' && (
              <Link to="/admin" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-base font-medium text-slate-700">
                {t('nav.admin')}
              </Link>
            )}
            <Link to="/dashboard" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2.5 text-base font-medium text-slate-700">
              {t('nav.dashboard')}
            </Link>
            <div className="my-2 border-t border-slate-100" />
            {user ? (
              <button
                type="button"
                onClick={() => {
                  logout()
                  setOpen(false)
                }}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium text-slate-700"
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
                {t('nav.logout')} ({user.full_name})
              </button>
            ) : (
              <div className="flex gap-2">
                <Link to="/login" onClick={() => setOpen(false)} className="btn-secondary flex-1">
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  {t('nav.login')}
                </Link>
                <Link to="/register" onClick={() => setOpen(false)} className="btn-primary flex-1">
                  {t('nav.register')}
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}