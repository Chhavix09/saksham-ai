import { Link, useRouterState } from '@tanstack/react-router'
import { Home, Calculator, MapPin, LayoutDashboard, Sparkles } from 'lucide-react'
import { useT } from '@/i18n'

const items = [
  { to: '/', key: 'nav.home', icon: Home },
  { to: '/onboarding', key: 'nav.findScheme', icon: Sparkles },
  { to: '/calculator', key: 'nav.calculator', icon: Calculator },
  { to: '/partners', key: 'nav.partners', icon: MapPin },
  { to: '/dashboard', key: 'nav.dashboard', icon: LayoutDashboard },
] as const

export default function BottomNav() {
  const { t } = useT()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
      aria-label="Bottom navigation"
    >
      <div className="grid grid-cols-5">
        {items.map(({ to, key, icon: Icon }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to)
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                active ? 'text-brand-700' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {t(key)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}