'use client'

/**
 * CP4: Live Orders board (owner)
 * Kanban columns: placed → preparing → ready → served
 * Realtime updates via Supabase channel
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, OrderStatus } from '@/types'
import Navbar from '@/components/Navbar'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import { PageLoader } from '@/components/LoadingSpinner'
import Link from 'next/link'

const ACTIVE_STATUSES: OrderStatus[] = ['placed', 'preparing', 'ready', 'served']
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: 'preparing',
  preparing: 'ready',
  ready: 'served',
}

export default function OrdersBoardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .in('status', ACTIVE_STATUSES)
      .order('created_at')
    setOrders((data as Order[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
    const channel = supabase.channel('orders_board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders])

  async function advanceStatus(order: Order) {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    await supabase.from('orders').update({ status: next, updated_at: new Date().toISOString() }).eq('id', order.id)
  }

  async function cancelOrder(order: Order) {
    if (!confirm('Cancel this order?')) return
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
  }

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">Live Orders</h1>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {ACTIVE_STATUSES.map((status) => {
            const colOrders = orders.filter((o) => o.status === status)
            return (
              <div key={status} className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <OrderStatusBadge status={status} />
                  <span className="text-xs text-gray-500">{colOrders.length}</span>
                </div>
                <div className="space-y-3">
                  {colOrders.map((order) => {
                    const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
                    return (
                      <div key={order.id} className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono text-gray-400">#{order.id.slice(0, 6)}</span>
                          <span className={`text-xs ${elapsed > 15 ? 'text-red-400' : 'text-gray-500'}`}>{elapsed}m ago</span>
                        </div>
                        <p className="text-sm font-medium text-white">₹{order.total.toFixed(2)}</p>
                        <div className="flex gap-1.5">
                          {NEXT_STATUS[status] && (
                            <button onClick={() => advanceStatus(order)} className="flex-1 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded-md">
                              → {NEXT_STATUS[status]}
                            </button>
                          )}
                          {status === 'served' && (
                            <Link href={`/dashboard/billing/${order.id}`} className="flex-1 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded-md text-center">
                              Bill
                            </Link>
                          )}

                        </div>
                      </div>
                    )
                  })}
                  {colOrders.length === 0 && <p className="text-xs text-gray-600 text-center py-4">Empty</p>}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
