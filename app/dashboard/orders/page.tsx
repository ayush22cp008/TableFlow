'use client'

/**
 * CP4: Live Orders board (all roles) + Order Cancellation UI
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
  const [userRole, setUserRole] = useState<string | null>(null)

  // Single Cancel State
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  // Bulk Cancel State
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkMode, setBulkMode] = useState<'all' | 'specific'>('all')
  const [bulkCategory, setBulkCategory] = useState('fire')
  const [bulkReason, setBulkReason] = useState('')
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])

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
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        setUserRole(profile?.role || null)
      }
      fetchOrders()
    }
    init()
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

  // Submit Single Cancel
  async function submitCancel(e: React.FormEvent) {
    e.preventDefault()
    if (!cancelModalOrder || !cancelReason.trim()) return

    await supabase.from('orders').update({ 
      status: 'cancelled',
      cancellation_reason: cancelReason.trim(),
      cancellation_category: 'manual'
    }).eq('id', cancelModalOrder.id)

    // Free table
    if (cancelModalOrder.table_id && cancelModalOrder.party_size) {
      const { data: tableData } = await supabase
        .from('restaurant_tables')
        .select('occupied_seats')
        .eq('id', cancelModalOrder.table_id)
        .single()

      if (tableData) {
        const newOccupied = Math.max(0, (tableData.occupied_seats || 0) - cancelModalOrder.party_size)
        await supabase.from('restaurant_tables').update({
          occupied_seats: newOccupied,
          status: newOccupied === 0 ? 'available' : 'occupied',
          reserved_from: null
        }).eq('id', cancelModalOrder.table_id)
      }
    }

    setCancelModalOrder(null)
    setCancelReason('')
    fetchOrders()
  }

  // Submit Bulk Cancel
  async function submitBulkCancel(e: React.FormEvent) {
    e.preventDefault()
    if (bulkMode === 'specific' && selectedOrderIds.length === 0) return

    const payloadIds = bulkMode === 'all' ? null : selectedOrderIds

    await supabase.rpc('cancel_active_orders', {
      p_reason: bulkReason.trim() || null,
      p_category: bulkCategory,
      p_order_ids: payloadIds
    })

    setBulkModalOpen(false)
    setSelectedOrderIds([])
    setBulkReason('')
    fetchOrders()
  }

  function toggleOrderSelect(id: string) {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-10 relative">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Live Orders</h1>
          {userRole === 'owner' && (
            <button 
              onClick={() => { setBulkModalOpen(true); setSelectedOrderIds([]); setBulkMode('all') }}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg font-medium shadow flex items-center gap-2 transition"
            >
              ⚠️ Bulk Emergency Stop
            </button>
          )}
        </div>

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
                    
                    const isSelectable = bulkModalOpen && bulkMode === 'specific' && status !== 'served'
                    const isSelected = selectedOrderIds.includes(order.id)

                    return (
                      <div 
                        key={order.id} 
                        className={`bg-gray-800 p-4 rounded-lg shadow-sm border flex flex-col transition cursor-default
                          ${isSelectable ? 'cursor-pointer hover:border-red-500' : 'border-gray-700/50'}
                          ${isSelected ? 'border-red-500 ring-1 ring-red-500' : ''}
                        `}
                        onClick={() => isSelectable && toggleOrderSelect(order.id)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex items-center gap-2">
                            {isSelectable && (
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                readOnly
                                className="mr-1 accent-red-500 pointer-events-none"
                              />
                            )}
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

                        {!bulkModalOpen && (
                          <div className="flex gap-1.5">
                            {NEXT_STATUS[status] && (
                              <button onClick={(e) => { e.stopPropagation(); advanceStatus(order) }} className="flex-1 py-1 text-xs bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-md">
                                → {NEXT_STATUS[status]}
                              </button>
                            )}
                            {status === 'served' && (
                              <Link href={`/dashboard/billing/${order.id}`} className="flex-1 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded-md text-center">
                                Bill
                              </Link>
                            )}
                            {status !== 'served' && (
                              <button onClick={(e) => { e.stopPropagation(); setCancelModalOrder(order) }} className="flex-1 py-1 text-xs bg-transparent border border-surface-border text-red-500 hover:bg-surface rounded-md">
                                Cancel
                              </button>
                            )}
                          </div>
                        )}
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

      {/* Single Cancel Modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <form onSubmit={submitCancel} className="bg-gray-900 border border-gray-800 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-4">Cancel Order</h2>
            <p className="text-gray-400 text-sm mb-4">Are you sure you want to cancel this order? This action cannot be undone.</p>
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Reason (Required)</label>
              <input
                required
                type="text"
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                placeholder="e.g. Customer changed mind, item out of stock"
              />
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" onClick={() => setCancelModalOrder(null)} className="px-4 py-2 text-sm text-gray-300 hover:text-white">
                Back
              </button>
              <button type="submit" className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg">
                Confirm Cancellation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bulk Cancel Modal (Owner) */}
      {bulkModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm px-4 pt-10">
          <form onSubmit={submitBulkCancel} className="bg-red-950/40 border border-red-900/50 p-6 rounded-xl w-full max-w-xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="absolute top-4 right-4 cursor-pointer text-gray-400 hover:text-white" onClick={() => setBulkModalOpen(false)}>✕</div>
            
            <h2 className="text-2xl font-bold text-red-500 mb-2">Bulk Emergency Stop</h2>
            <p className="text-gray-300 text-sm mb-6">Instantly cancel multiple active orders. This bypasses normal flow and frees tables.</p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Cancellation Mode</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" checked={bulkMode === 'all'} onChange={() => setBulkMode('all')} className="accent-red-500" />
                    Cancel ALL Active Orders
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" checked={bulkMode === 'specific'} onChange={() => setBulkMode('specific')} className="accent-red-500" />
                    Select Specific Orders
                  </label>
                </div>
                {bulkMode === 'specific' && (
                  <p className="text-xs text-amber-500 mt-2 font-medium">Please select the orders on the board behind this modal.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Category (Required)</label>
                <select 
                  value={bulkCategory} 
                  onChange={e => setBulkCategory(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none"
                >
                  <option value="fire">Fire Emergency</option>
                  <option value="food_safety">Food Safety Issue</option>
                  <option value="natural_disaster">Natural Disaster</option>
                  <option value="other">Other Emergency</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Additional Details (Optional)</label>
                <textarea
                  value={bulkReason}
                  onChange={e => setBulkReason(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none resize-none"
                  placeholder="e.g. Kitchen evacuated, gas leak..."
                />
              </div>
            </div>

            <div className="flex justify-end mt-8">
              <button 
                type="submit" 
                disabled={bulkMode === 'specific' && selectedOrderIds.length === 0}
                className="w-full py-3 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold disabled:opacity-50 transition"
              >
                {bulkMode === 'all' 
                  ? 'CANCEL ALL ACTIVE ORDERS NOW' 
                  : `CANCEL ${selectedOrderIds.length} SELECTED ORDERS NOW`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
