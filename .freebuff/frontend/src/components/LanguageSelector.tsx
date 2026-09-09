import { useEffect, useRef, useState } from 'react'
import { Check, Globe, ChevronDown } from 'lucide-react'
import { useT } from '@/i18n'
import type { Lang } from '@/i18n'

export default function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, languageNames, t } = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('nav.language')}
        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50"
      >
        <Globe className="h-4 w-4 text-brand-700" aria-hidden="true" />
        {!compact && <span>{languageNames[lang]}</span>}
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t('nav.language')}
          className="absolute right-0 z-50 mt-2 max-h-80 w-44 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {(Object.keys(languageNames) as Lang[]).map((code) => (
            <li key={code} role="option" aria-selected={lang === code}>
              <button
                type="button"
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50 ${
                  lang === code ? 'font-semibold text-brand-800' : 'text-slate-700'
                }`}
                onClick={() => {
                  setLang(code)
                  setOpen(false)
                }}
              >
                <span>{languageNames[code]}</span>
                {lang === code && <Check className="h-4 w-4 text-brand-700" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}