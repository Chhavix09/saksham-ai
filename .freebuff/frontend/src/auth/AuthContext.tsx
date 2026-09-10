import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '@/api/endpoints'
import { getToken, setToken } from '@/api/client'
import type { User } from '@/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<User>
  register: (payload: Record<string, unknown>) => Promise<User>
  logout: () => void
  refreshUser: () => Promise<void>
  setUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem('saksham_user')
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(readStoredUser)
  const [loading, setLoading] = useState(true)

  const applyAuth = useCallback((token: string, userData: User) => {
    setToken(token)
    localStorage.setItem('saksham_user', JSON.stringify(userData))
    setUserState(userData)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    localStorage.removeItem('saksham_user')
    setUserState(null)
  }, [])

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    try {
      const me = await authApi.me()
      localStorage.setItem('saksham_user', JSON.stringify(me))
      setUserState(me)
    } catch {
      logout()
    } finally {
      setLoading(false)
    }
  }, [logout])

  useEffect(() => {
    void refreshUser()
    const onUnauthorized = () => logout()
    window.addEventListener('saksham:unauthorized', onUnauthorized)
    return () => window.removeEventListener('saksham:unauthorized', onUnauthorized)
  }, [refreshUser, logout])

  const login = useCallback(
    async (identifier: string, password: string, rememberMe = false) => {
      const res = await authApi.login({ identifier, password, remember_me: rememberMe })
      applyAuth(res.access_token, res.user)
      return res.user
    },
    [applyAuth],
  )

  const register = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await authApi.register(payload)
      applyAuth(res.access_token, res.user)
      return res.user
    },
    [applyAuth],
  )

  const setUser = useCallback((next: User) => {
    localStorage.setItem('saksham_user', JSON.stringify(next))
    setUserState(next)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser, setUser }),
    [user, loading, login, register, logout, refreshUser, setUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    return {
      user: null,
      loading: false,
      login: async () => {
        throw new Error('AuthProvider is not mounted')
      },
      register: async () => {
        throw new Error('AuthProvider is not mounted')
      },
      logout: () => undefined,
      refreshUser: async () => undefined,
      setUser: () => undefined,
    }
  }
  return ctx
}