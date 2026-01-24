import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Calendar, UtensilsCrossed, ShoppingCart, LogOut, Menu, X } from 'lucide-react'
import { clsx } from 'clsx'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import CalendarPage from '@/pages/CalendarPage'
import DinnersPage from '@/pages/DinnersPage'
import ShoppingPage from '@/pages/ShoppingPage'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Button from '@/components/ui/Button'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

type Page = 'calendar' | 'dinners' | 'shopping'

function AppContent() {
  const { user, isLoading, login, logout } = useAuth()
  const [currentPage, setCurrentPage] = useState<Page>('calendar')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center">
          <h1 className="text-3xl font-display font-bold text-neutral-800 mb-2">
            What's Cookin'?
          </h1>
          <p className="text-neutral-500 mb-6">
            Track your dinners, plan your meals, build your shopping lists.
          </p>
          <Button variant="primary" onClick={login} className="w-full">
            Sign in with Google
          </Button>
        </div>
      </div>
    )
  }

  const navItems = [
    { id: 'calendar' as Page, label: 'Calendar', icon: Calendar },
    { id: 'dinners' as Page, label: 'Dinners', icon: UtensilsCrossed },
    { id: 'shopping' as Page, label: 'Shopping', icon: ShoppingCart },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍳</span>
              <span className="font-display font-bold text-xl text-neutral-800">What's Cookin'</span>
            </div>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                    currentPage === item.id
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </nav>

            {/* User menu */}
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-sm text-neutral-500">
                {user.name}
              </span>
              <button
                onClick={logout}
                className="p-2 hover:bg-neutral-100 rounded-lg transition-colors text-neutral-500"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 hover:bg-neutral-100 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          {mobileMenuOpen && (
            <nav className="md:hidden py-3 border-t border-neutral-100">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentPage(item.id)
                    setMobileMenuOpen(false)
                  }}
                  className={clsx(
                    'flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-colors',
                    currentPage === item.id
                      ? 'bg-primary-100 text-primary-700'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {currentPage === 'calendar' && <CalendarPage />}
        {currentPage === 'dinners' && <DinnersPage />}
        {currentPage === 'shopping' && <ShoppingPage />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  )
}
