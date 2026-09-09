import { Link } from '@tanstack/react-router'
import { Sparkles } from 'lucide-react'
import { useT } from '@/i18n'

export default function Footer() {
  const { t } = useT()
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-base font-bold text-brand-900">
                Scheme<span className="text-saffron-500">Up</span>
              </span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-slate-600">{t('footer.about')}</p>
            <p className="mt-3 text-sm italic text-slate-500">{t('app.tagline')}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t('footer.links')}</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/onboarding" className="text-slate-700 hover:text-brand-700">
                  {t('nav.findScheme')}
                </Link>
              </li>
              <li>
                <Link to="/calculator" className="text-slate-700 hover:text-brand-700">
                  {t('nav.calculator')}
                </Link>
              </li>
              <li>
                <Link to="/partners" className="text-slate-700 hover:text-brand-700">
                  {t('nav.partners')}
                </Link>
              </li>
              <li>
                <Link to="/register" className="text-slate-700 hover:text-brand-700">
                  {t('nav.register')}
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Scheme Up</h3>
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
              {t('footer.demoNote')}
            </p>
            <p className="mt-3 text-xs text-slate-400">© {new Date().getFullYear()} Scheme Up. {t('footer.rights')}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}