import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { RouterProvider } from '@tanstack/react-router'

import { AuthProvider } from '@/auth/AuthContext'
import { LanguageProvider } from '@/i18n'
import { router } from '@/routes'
import { ToastProvider } from '@/components/Toast'
import '@/index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <AuthProvider>
            <LanguageProvider>
              <RouterProvider router={router} />
            </LanguageProvider>
          </AuthProvider>
        </ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>,
)