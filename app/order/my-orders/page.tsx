'use client'

/**
 * CP4: My Orders page — live order status via Realtime + feedback submission
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { Order } from '@/types'
import Navbar from '@/components/Navbar'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import FeedbackButtons from '@/components/FeedbackButtons'
import { PageLoader } from '@/components/LoadingSpinner'

export default function MyOrdersPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
    setOrders((data as Order[]) ?? [])
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
                    <p className="text-xs text-gray-500 font-mono">{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-gray-400">{new Date(order.created_at).toLocaleString()}</p>
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
