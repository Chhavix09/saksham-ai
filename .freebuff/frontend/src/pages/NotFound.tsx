import { Link } from '@tanstack/react-router'
import { Home, SearchX } from 'lucide-react'
import { useT } from '@/i18n'

export default function NotFound() {
  const { t } = useT()
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
      <SearchX className="h-16 w-16 text-slate-300" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">{t('err.notFound.title')}</h1>
      <p className="mt-2 text-sm text-slate-500">{t('err.notFound.desc')}</p>
      <Link to="/" className="btn-primary mt-6">
        <Home className="h-4 w-4" aria-hidden="true" />
        {t('err.notFound.home')}
      </Link>
    </div>
  )
}