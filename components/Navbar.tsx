'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import NotificationBell from './NotificationBell'

/**
 * Shared top navigation bar — role-aware.
 * Shows different links for customer vs owner.
 * Mobile: hamburger menu collapses nav links into a slide-down drawer.
 */
export default function Navbar() {
  const { role, user, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  const customerLinks = (
    <>
      <Link href="/order"            className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Menu</Link>
      <Link href="/order/my-orders"  className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>My Orders</Link>
      <Link href="/order/reservation" className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Reservation</Link>
    </>
  )

  const ownerLinks = (
    <>
      <Link href="/dashboard"             className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Overview</Link>
      <Link href="/dashboard/menu"        className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Menu</Link>
      <Link href="/dashboard/tables"      className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Tables</Link>
      <Link href="/dashboard/orders"      className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Orders</Link>
      <Link href="/dashboard/analytics"   className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Analytics</Link>
      <Link href="/dashboard/insights"    className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>AI Insights</Link>
      <Link href="/dashboard/staff"       className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Staff</Link>
    </>
  )

  const managerLinks = (
    <>
      <Link href="/dashboard/manager" className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Overview</Link>
      <Link href="/dashboard/tables"  className="block px-3 py-2 text-sm text-gray-300 hover:text-white transition-colors" onClick={() => setMobileOpen(false)}>Tables</Link>
    </>
  )

  const logoHref =
    role === 'owner'   ? '/dashboard'         :
    role === 'manager' ? '/dashboard/manager' :
    role === 'waiter'  ? '/dashboard/waiter'  : '/'

  return (
    <nav className="border-b border-gray-800 bg-gray-900/70 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* LEFT: Logo only */}
          <Link href={logoHref} className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg text-sm">
              TF
            </div>
            <span className="font-semibold text-lg tracking-tight text-white">TableFlow</span>
          </Link>

          {/* RIGHT: Desktop nav links + Bell + Sign Out — all one coherent cluster */}
          <div className="flex items-center gap-1">
            {/* Desktop Nav Links */}
            <div className="hidden sm:flex items-center gap-1">
              {user && role === 'customer' && customerLinks}
              {user && role === 'owner'    && ownerLinks}
              {user && role === 'manager'  && managerLinks}
            </div>

            {/* Notification Bell (always rendered exactly once for staff roles) */}
            {user && ['waiter', 'cook', 'manager'].includes(role || '') && (
              <NotificationBell userId={user.id} role={role!} />
            )}

            {/* Desktop Auth Buttons */}
            {user ? (
              <button
                onClick={signOut}
                className="hidden sm:block ml-2 px-4 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white transition-colors border border-gray-700"
              >
                Sign Out
              </button>
            ) : (
              <Link href="/login" className="hidden sm:block ml-2 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors">
                Sign In
              </Link>
            )}

            {/* Mobile Hamburger Menu Toggle & Mobile Auth */}
            {user && (
              <button
                onClick={() => setMobileOpen((o) => !o)}
                className="sm:hidden p-2 rounded-lg hover:bg-gray-700 transition-colors"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              >
                {mobileOpen ? <X className="w-5 h-5 text-gray-300" /> : <Menu className="w-5 h-5 text-gray-300" />}
              </button>
            )}
            {!user && (
              <Link href="/login" className="sm:hidden px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition-colors">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-gray-800 bg-gray-900/95 backdrop-blur-md px-4 py-3 flex flex-col gap-1">
          {user && role === 'customer' && customerLinks}
          {user && role === 'owner'    && ownerLinks}
          {user && role === 'manager'  && managerLinks}
          {user && (
            <button
              onClick={() => { signOut(); setMobileOpen(false) }}
              className="mt-2 w-full text-left px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-white transition-colors border border-gray-700"
            >
              Sign Out
            </button>
          )}
        </div>
      )}
    </nav>
  )
}


