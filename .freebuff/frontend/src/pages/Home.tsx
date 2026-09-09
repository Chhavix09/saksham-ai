import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRight, Bot, Calculator, CheckCircle2, Globe2, GraduationCap, Landmark, Languages, MapPin, ShieldCheck, Sparkles, TrendingUp, Wallet } from 'lucide-react'
import { motion } from 'framer-motion'
import { useT } from '@/i18n'
import { publicApi } from '@/api/endpoints'
import { formatNumber } from '@/utils/format'
import { LoadingState, ErrorState, Disclaimer } from '@/components/ui'
import SchemeCard from '@/components/SchemeCard'
import type { Scheme } from '@/types'

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.4 },
}

export default function Home() {
  const { t } = useT()
  const navigate = useNavigate()
  const statsQuery = useQuery({ queryKey: ['public-stats'], queryFn: publicApi.stats })
  const configQuery = useQuery({ queryKey: ['public-config'], queryFn: publicApi.config })
  const schemesQuery = useQuery({ queryKey: ['schemes'], queryFn: publicApi.schemes })

  const howItWorks = [
    { icon: Sparkles, title: 'home.how.step1.title', desc: 'home.how.step1.desc' },
    { icon: Bot, title: 'home.how.step2.title', desc: 'home.how.step2.desc' },
    { icon: Calculator, title: 'home.how.step3.title', desc: 'home.how.step3.desc' },
    { icon: MapPin, title: 'home.how.step4.title', desc: 'home.how.step4.desc' },
  ]

  const whyCards = [
    { icon: Bot, title: 'home.why.card1.title', desc: 'home.why.card1.desc' },
    { icon: CheckCircle2, title: 'home.why.card2.title', desc: 'home.why.card2.desc' },
    { icon: Languages, title: 'home.why.card3.title', desc: 'home.why.card3.desc' },
    { icon: Calculator, title: 'home.why.card4.title', desc: 'home.why.card4.desc' },
    { icon: MapPin, title: 'home.why.card5.title', desc: 'home.why.card5.desc' },
    { icon: ShieldCheck, title: 'home.why.card6.title', desc: 'home.why.card6.desc' },
    { icon: TrendingUp, title: 'home.why.card7.title', desc: 'home.why.card7.desc' },
  ]

  const categories = [
    { icon: Wallet, title: 'home.categories.micro.title', desc: 'home.categories.micro.desc', category: 'micro_finance' },
    { icon: Landmark, title: 'home.categories.term.title', desc: 'home.categories.term.desc', category: 'term_loan' },
    { icon: GraduationCap, title: 'home.categories.edu.title', desc: 'home.categories.edu.desc', category: 'educational' },
  ]

  const stats = statsQuery.data?.stats
  const impactItems = stats
    ? [
        { icon: MapPin, value: formatNumber(stats.partners), label: 'home.impact.partners' },
        { icon: Landmark, value: formatNumber(stats.schemes), label: 'home.impact.schemes' },
        { icon: Languages, value: String(stats.languages), label: 'home.impact.languages' },
        { icon: Sparkles, value: formatNumber(stats.recommendations), label: 'home.impact.ai' },
      ]
    : []

  const groupedSchemes = (schemesQuery.data ?? []).reduce<Record<string, Scheme[]>>((acc, s) => {
    acc[s.category] = acc[s.category] ?? []
    acc[s.category].push(s)
    return acc
  }, {})

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 2px, transparent 2px)', backgroundSize: '32px 32px' }} aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
          <motion.div {...fadeUp} className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-brand-50">
              <Sparkles className="h-4 w-4 text-saffron-400" aria-hidden="true" />
              {t('app.tagline')}
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight text-white md:text-5xl">{t('home.hero.title')}</h1>
            <p className="mt-5 text-lg leading-relaxed text-brand-100">{t('home.hero.subtitle')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/onboarding" className="btn-saffron text-lg">
                {t('home.cta.findScheme')}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
              <Link to="/calculator" className="btn bg-white/10 text-white border border-white/30 hover:bg-white/20">
                {t('home.cta.calcEmi')}
              </Link>
              <Link to="/partners" className="btn bg-white/10 text-white border border-white/30 hover:bg-white/20">
                {t('home.cta.findPartner')}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <motion.div {...fadeUp} className="text-center">
          <h2 className="section-title">{t('home.how.title')}</h2>
        </motion.div>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {howItWorks.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.li key={step.title} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.06 }} className="card relative">
                <span className="absolute right-4 top-4 text-4xl font-extrabold text-slate-100" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{t(step.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{t(step.desc)}</p>
              </motion.li>
            )
          })}
        </ol>
      </section>

      {/* Why SakshamAI */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div {...fadeUp} className="text-center">
            <h2 className="section-title">{t('home.why.title')}</h2>
          </motion.div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {whyCards.map((card, i) => {
              const Icon = card.icon
              return (
                <motion.div key={card.title} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.05 }} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-700 shadow-sm">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{t(card.title)}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{t(card.desc)}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Scheme categories */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <motion.div {...fadeUp} className="text-center">
          <h2 className="section-title">{t('home.categories.title')}</h2>
        </motion.div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {categories.map((cat, i) => {
            const Icon = cat.icon
            return (
              <motion.div key={cat.category} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.05 }} className="card">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-saffron-50 text-saffron-600">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{t(cat.title)}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{t(cat.desc)}</p>
                <Link to="/onboarding" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800">
                  {t('home.categories.explore')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </motion.div>
            )
          })}
        </div>

        {schemesQuery.isLoading ? (
          <div className="mt-10"><LoadingState /></div>
        ) : schemesQuery.isError ? (
          <div className="mt-10"><ErrorState message={t('err.generic')} onRetry={() => schemesQuery.refetch()} /></div>
        ) : (
          <div className="mt-10 space-y-8">
            {Object.entries(groupedSchemes).map(([category, list]) => (
              <div key={category}>
                <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-800">
                  {t(`scheme.category.${category}`)}
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {list.map((scheme) => (
                    <SchemeCard
                      key={scheme.id}
                      scheme={scheme}
                      onClick={() => navigate({ to: '/onboarding', search: { scheme: String(scheme.id) } })}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Impact */}
      <section className="bg-brand-900 py-14">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div {...fadeUp} className="text-center">
            <h2 className="text-2xl font-bold text-white md:text-3xl">{t('home.impact.title')}</h2>
          </motion.div>
          {statsQuery.isLoading ? (
            <div className="mt-8"><LoadingState /></div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {impactItems.map((item, i) => {
                const Icon = item.icon
                return (
                  <motion.div key={item.label} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.06 }} className="rounded-2xl bg-white/10 p-5 text-center backdrop-blur">
                    <Icon className="mx-auto h-7 w-7 text-saffron-400" aria-hidden="true" />
                    <div className="mt-2 text-3xl font-extrabold text-white">{item.value}</div>
                    <div className="mt-1 text-sm text-brand-100">{t(item.label)}</div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <Disclaimer text={configQuery.data?.disclaimer ?? t('app.disclaimer')} />
      </div>
    </div>
  )
}