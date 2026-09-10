import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '@/auth/AuthContext'
import { usersApi } from '@/api/endpoints'

import en from '@/locales/en.json'
import hi from '@/locales/hi.json'
import gu from '@/locales/gu.json'
import mr from '@/locales/mr.json'
import bn from '@/locales/bn.json'
import ta from '@/locales/ta.json'
import te from '@/locales/te.json'
import kn from '@/locales/kn.json'

export const SUPPORTED_LANGUAGES = ['en', 'hi', 'gu', 'mr', 'bn', 'ta', 'te', 'kn'] as const
export type Lang = (typeof SUPPORTED_LANGUAGES)[number]

const LANGUAGE_NAMES: Record<Lang, string> = {
  en: 'English',
  hi: 'हिन्दी',
  gu: 'ગુજરાતી',
  mr: 'मराठी',
  bn: 'বাংলা',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  kn: 'ಕನ್ನಡ',
}

const dicts: Record<Lang, Record<string, string>> = { en, hi, gu, mr, bn, ta, te, kn } as Record<
  Lang,
  Record<string, string>
>

interface I18nContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
  languageNames: Record<Lang, string>
}

const I18nContext = createContext<I18nContextValue | null>(null)

function initialLang(): Lang {
  const stored = localStorage.getItem('saksham_lang') as Lang | null
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored
  return 'en'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const { user } = useAuth()

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next)
      localStorage.setItem('saksham_lang', next)
      // Persist preference to the user profile when logged in (fire-and-forget)
      if (user && user.preferred_language !== next) {
        usersApi.updateMe({ preferred_language: next }).catch(() => undefined)
      }
    },
    [user],
  )

  // Apply the user's saved preference after auth loads
  useEffect(() => {
    if (user?.preferred_language && SUPPORTED_LANGUAGES.includes(user.preferred_language as Lang)) {
      const pref = user.preferred_language as Lang
      setLangState(pref)
      localStorage.setItem('saksham_lang', pref)
    }
  }, [user?.preferred_language])

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let text = dicts[lang][key] ?? dicts.en[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.split(`{${k}}`).join(String(v))
        }
      }
      return text
    },
    [lang],
  )

  const value = useMemo(
    () => ({ lang, setLang, t, languageNames: LANGUAGE_NAMES }),
    [lang, setLang, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    const fallbackT = (key: string, vars?: Record<string, string | number>) => {
      let text = dicts.en[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          text = text.split(`{${k}}`).join(String(v))
        }
      }
      return text
    }

    return {
      lang: 'en',
      setLang: () => undefined,
      t: fallbackT,
      languageNames: LANGUAGE_NAMES,
    }
  }
  return ctx
}