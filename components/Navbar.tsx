import Link from 'next/link'
import { useAuth } from '@/lib/AuthContext'

/**
 * Shared top navigation bar — role-aware.
 * Shows different links for customer vs owner.
 */
export default function Navbar() {
  const { role, user, signOut } = useAuth()

  return (
    <nav className="border-b border-gray-800 bg-gray-900/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href={role === 'owner' ? '/dashboard' : '/'} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg text-sm">
              TF
            </div>
            <span className="font-semibold text-lg tracking-tight text-white">TableFlow</span>
          </Link>

          {/* Nav Links */}
          <div className="flex items-center gap-2">
            {user && role === 'customer' && (
              <>
                <Link href="/order" className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors">Menu</Link>
                <Link href="/order/my-orders" className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors">My Orders</Link>
              </>
            )}
            {user && role === 'owner' && (
              <>
                <Link href="/dashboard" className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors">Overview</Link>
                <Link href="/dashboard/menu" className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors">Menu</Link>
                <Link href="/dashboard/tables" className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors">Tables</Link>
                <Link href="/dashboard/orders" className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors">Orders</Link>
                <Link href="/dashboard/analytics" className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors">Analytics</Link>
                <Link href="/dashboard/insights" className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition-colors">AI Insights</Link>
              </>
            )}

            {user ? (
              <button
                onClick={signOut}
                className="ml-2 px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white transition-colors border border-gray-700"
              >
                Sign Out
              </button>
            ) : (
              <Link href="/login" className="ml-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
