'use client'

import { useAuth } from '@/lib/AuthContext'
import { PageLoader } from '@/components/LoadingSpinner'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, loading } = useAuth()

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Owner Dashboard</h1>
          <p className="text-gray-400 mt-1">Welcome back, <span className="text-indigo-400">{user?.email}</span></p>
        </div>

        {/* Quick-action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { href: '/dashboard/orders',   icon: '📋', label: 'Live Orders',       desc: 'View and update incoming orders in real time' },
            { href: '/dashboard/menu',     icon: '🍽️', label: 'Menu Management',  desc: 'Add items, toggle availability, soft delete' },
            { href: '/dashboard/tables',   icon: '🪑', label: 'Tables & Waitlist', desc: 'Manage table status and seat waiting customers' },
            { href: '/dashboard/billing/demo', icon: '🧾', label: 'Billing',       desc: 'Generate itemized bills with optional service charge' },
            { href: '/dashboard/analytics',icon: '📊', label: 'Analytics',         desc: "Today's revenue, top dishes, 7-day trend" },
            { href: '/dashboard/insights', icon: '🤖', label: 'AI Insights',       desc: 'Gemini-powered prep forecasts and dish classification' },
          ].map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="p-6 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-indigo-500/50 transition-all group"
            >
              <div className="text-3xl mb-3">{card.icon}</div>
              <h3 className="font-semibold text-white mb-1 group-hover:text-indigo-400 transition-colors">{card.label}</h3>
              <p className="text-sm text-gray-400">{card.desc}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
