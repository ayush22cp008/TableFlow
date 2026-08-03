'use client'

/**
 * CP4: Live Orders board (owner)
 * Kanban columns: placed → preparing → ready → served
 * Realtime updates via Supabase channel
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, OrderStatus, OrderWithItems } from '@/types'
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
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(quantity, menu_items(name))')
      .in('status', ACTIVE_STATUSES)
      .order('is_priority', { ascending: false })
      .order('created_at', { ascending: true })
    setOrders((data as unknown as OrderWithItems[]) ?? [])
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

    if (order.table_id) {
      if (order.party_size == null) {
        console.warn('Skipping table capacity update: order.party_size is null/undefined')
      } else {
        const { data: tableData } = await supabase
          .from('restaurant_tables')
          .select('occupied_seats')
          .eq('id', order.table_id)
          .single()

        if (tableData) {
          const currentOccupied = tableData.occupied_seats || 0
          const newOccupiedSeats = Math.max(0, currentOccupied - order.party_size)
          await supabase.from('restaurant_tables').update({
            occupied_seats: newOccupiedSeats,
            status: newOccupiedSeats === 0 ? 'available' : 'occupied',
            reserved_from: null
          }).eq('id', order.table_id)
        }
      }
    }

    fetchOrders()
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
              <div key={status} className="bg-gray-900/40 border border-gray-800 rounded-card shadow-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <OrderStatusBadge status={status} />
                  <span className="text-xs text-gray-500">{colOrders.length}</span>
                </div>
                <div className="space-y-3">
                  {colOrders.map((order) => {
                    const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
                    const orderNumber = order.daily_number
                      ? `${order.is_priority ? 'R' : 'W'}${order.daily_number}`
                      : `#${order.id.slice(0, 6)}`
                    
                    return (
                      <div key={order.id} className="bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-700/50 flex flex-col">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white font-mono">{orderNumber}</span>
                            {order.is_priority && (
                              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-amber-500/20 text-amber-400 tracking-wider border border-amber-500/30">
                                Priority
                              </span>
                            )}
                            {order.table_id && (
                              <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-gray-700 text-gray-300 tracking-wider">
                                Table
                              </span>
                            )}
                          </div>
                          <span className={`text-xs ${elapsed > 15 ? 'text-red-400' : 'text-gray-400'}`}>{elapsed}m ago</span>
                        </div>
                        <p className="text-sm font-medium text-amber-500 mb-2">₹{order.total.toFixed(2)}</p>
                        <ul className="text-xs text-gray-400 space-y-0.5 mb-3">
                          {order.order_items?.map((item, i) => (
                            <li key={i}>{item.quantity}x {item.menu_items?.name}</li>
                          ))}
                        </ul>
                        <div className="flex gap-1.5">
                          {NEXT_STATUS[status] && (
                            <button onClick={() => advanceStatus(order)} className="flex-1 py-1 text-xs bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-md">
                              → {NEXT_STATUS[status]}
                            </button>
                          )}
                          {status === 'served' && (
                            <Link href={`/dashboard/billing/${order.id}`} className="flex-1 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded-md text-center">
                              Bill
                            </Link>
                          )}
                          {status !== 'served' && (
                            <button onClick={() => cancelOrder(order)} className="flex-1 py-1 text-xs bg-transparent border border-surface-border text-red-500 hover:bg-surface rounded-md">
                              Cancel
                            </button>
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
