'use client'

/**
 * CP4: My Orders page — live order status via Realtime + feedback submission
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import Navbar from '@/components/Navbar'
import { formatOrderNumber } from '@/lib/utils'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import FeedbackButtons from '@/components/FeedbackButtons'
import { PageLoader } from '@/components/LoadingSpinner'

export default function MyOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('orders')
      .select('*, restaurant_tables(table_number)')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (authLoading) return
    fetchOrders()

    // Realtime: order status updates
    const channel = supabase
      .channel('my_orders_realtime')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders, authLoading])

  if (authLoading || loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight mb-6">My Orders</h1>

        {orders.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">📦</div>
            <p>No orders yet. <a href="/order" className="text-indigo-400 underline">Browse the menu</a></p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="p-5 bg-surface border border-surface-border rounded-card shadow-card space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="text-lg font-bold text-white">Order {formatOrderNumber(order)}</p>
                      {order.restaurant_tables?.table_number && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-300 border border-gray-700">
                          Table {order.restaurant_tables.table_number}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <div className="flex items-center justify-between border-t border-gray-800 pt-3">
                  <span className="text-gray-400 text-sm">Total</span>
                  <span className="text-accent-amber font-semibold">₹{order.total.toFixed(2)}</span>
                </div>
                {(order.status === 'served' || order.status === 'billed') && (
                  <div className="border-t border-gray-800 pt-3">
                    <FeedbackButtons orderId={order.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
