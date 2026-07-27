'use client'

/**
 * CP6: Analytics dashboard (owner)
 * - Today's revenue, order count, avg order value
 * - Top 5 dishes by quantity
 * - 7-day revenue trend (pure CSS bars — no charting library)
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { PageLoader } from '@/components/LoadingSpinner'

interface DaySummary { date: string; revenue: number; orders: number }

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [todayRevenue, setTodayRevenue] = useState(0)
  const [todayOrders, setTodayOrders] = useState(0)
  const [avgValue, setAvgValue] = useState(0)
  const [topDishes, setTopDishes] = useState<{ name: string; count: number }[]>([])
  const [weekData, setWeekData] = useState<DaySummary[]>([])

  useEffect(() => {
    async function load() {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0, 0, 0, 0)

      const { data: todayOrdersData } = await supabase
        .from('orders')
        .select('total, created_at')
        .gte('created_at', todayStart.toISOString())
        .neq('status', 'cancelled')

      const rev = todayOrdersData?.reduce((s, o) => s + (o.total ?? 0), 0) ?? 0
      const cnt = todayOrdersData?.length ?? 0
      setTodayRevenue(rev)
      setTodayOrders(cnt)
      setAvgValue(cnt > 0 ? rev / cnt : 0)

      // Top dishes (week)
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('quantity, menu_items(name), orders!inner(created_at)')
        .gte('orders.created_at', weekStart.toISOString())

      const dishMap: Record<string, number> = {}
      itemsData?.forEach((item: { quantity: number; menu_items: { name: string }[] | { name: string } | null }) => {
        const menuItem = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items
        const name = menuItem?.name ?? 'Unknown'
        dishMap[name] = (dishMap[name] ?? 0) + item.quantity
      })
      setTopDishes(Object.entries(dishMap).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, count]) => ({ name, count })))

      // 7-day trend
      const { data: weekOrders } = await supabase
        .from('orders')
        .select('total, created_at')
        .gte('created_at', weekStart.toISOString())
        .neq('status', 'cancelled')

      const dayMap: Record<string, DaySummary> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i)
        const key = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
        dayMap[d.toDateString()] = { date: key, revenue: 0, orders: 0 }
      }
      weekOrders?.forEach((o) => {
        const key = new Date(o.created_at).toDateString()
        if (dayMap[key]) { dayMap[key].revenue += o.total ?? 0; dayMap[key].orders++ }
      })
      setWeekData(Object.values(dayMap))
      setLoading(false)
    }
    load()
  }, [])

  const maxRevenue = Math.max(...weekData.map((d) => d.revenue), 1)

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">Analytics</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {[
            { label: "Today's Revenue", value: `₹${todayRevenue.toFixed(2)}`, sub: 'net of cancelled', color: 'text-indigo-400' },
            { label: 'Orders Today', value: String(todayOrders), sub: 'completed orders', color: 'text-purple-400' },
            { label: 'Avg Order Value', value: `₹${avgValue.toFixed(2)}`, sub: 'per order', color: 'text-pink-400' },
          ].map((kpi) => (
            <div key={kpi.label} className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl">
              <p className="text-gray-400 text-sm mb-1">{kpi.label}</p>
              <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-gray-500 text-xs mt-1">{kpi.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 7-day revenue bar chart — pure CSS */}
          <div className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl">
            <h2 className="font-semibold text-white mb-4">Revenue — Last 7 Days</h2>
            <div className="flex items-end gap-2 h-40">
              {weekData.map((day) => (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-gray-500">{day.revenue > 0 ? `₹${Math.round(day.revenue)}` : ''}</span>
                  <div
                    className="w-full rounded-t-md bg-indigo-600/80 hover:bg-indigo-500 transition-all"
                    style={{ height: `${Math.max((day.revenue / maxRevenue) * 144, 4)}px` }}
                    title={`₹${day.revenue.toFixed(2)}, ${day.orders} orders`}
                  />
                  <span className="text-xs text-gray-500">{day.date}</span>
                </div>
              ))}
            </div>
            {weekData.every((d) => d.revenue === 0) && (
              <p className="text-center text-gray-500 text-sm mt-4">No order data yet. Place some orders to see the chart!</p>
            )}
          </div>

          {/* Top dishes */}
          <div className="p-5 bg-gray-900/50 border border-gray-800 rounded-xl">
            <h2 className="font-semibold text-white mb-4">Top Dishes This Week</h2>
            {topDishes.length === 0 ? (
              <p className="text-gray-500 text-sm">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {topDishes.map((dish, i) => (
                  <div key={dish.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white">{i + 1}. {dish.name}</span>
                      <span className="text-gray-400">{dish.count} sold</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                        style={{ width: `${(dish.count / (topDishes[0]?.count ?? 1)) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
