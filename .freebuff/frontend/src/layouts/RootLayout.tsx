import { Suspense } from 'react'
import { Outlet } from '@tanstack/react-router'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import BottomNav from '@/components/BottomNav'
import ChatAssistant from '@/components/ChatAssistant'
import { Loader2 } from 'lucide-react'

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
      <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
    </div>
  )
}

export default function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pb-20 md:pb-0">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <BottomNav />
      <ChatAssistant />
    </div>
  )
}