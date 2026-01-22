import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import GoogleSignInButton from '@/components/auth/GoogleSignInButton'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function LoginPage() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 via-white to-accent-50 px-4">
      {/* Logo and title */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🍳</div>
        <h1 className="text-4xl font-display font-bold text-primary-700 mb-2">
          What's Cookin
        </h1>
        <p className="text-neutral-600 max-w-md">
          Track your dinners, plan your meals, and never wonder "what did we have last week?" again.
        </p>
      </div>

      {/* Login card */}
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-neutral-100">
        <h2 className="text-xl font-semibold text-neutral-800 mb-6 text-center">
          Sign in to continue
        </h2>

        <div className="flex justify-center">
          <GoogleSignInButton />
        </div>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Access is limited to authorized users only.
        </p>
      </div>

      {/* Features preview */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl">
        <div className="text-center">
          <div className="text-3xl mb-2">📅</div>
          <h3 className="font-medium text-neutral-700">Calendar View</h3>
          <p className="text-sm text-neutral-500">See what you ate at a glance</p>
        </div>
        <div className="text-center">
          <div className="text-3xl mb-2">🛒</div>
          <h3 className="font-medium text-neutral-700">Shopping Lists</h3>
          <p className="text-sm text-neutral-500">Generate lists from recipes</p>
        </div>
        <div className="text-center">
          <div className="text-3xl mb-2">⭐</div>
          <h3 className="font-medium text-neutral-700">Rate & Review</h3>
          <p className="text-sm text-neutral-500">Track your favorites</p>
        </div>
      </div>
    </div>
  )
}
