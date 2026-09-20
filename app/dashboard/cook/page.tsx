'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { OrderWithItems, Order } from '@/types'
import Navbar from '@/components/Navbar'

export default function CookDashboardPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)

  const fetchPreparingOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(quantity, menu_items(name))')
      .eq('status', 'preparing')
      .order('is_priority', { ascending: false })
      .order('created_at', { ascending: true })
    
    setOrders((data as unknown as OrderWithItems[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setUserId(data.session.user.id)
      }
    })

    fetchPreparingOrders()
    const channel = supabase.channel('cook_orders_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchPreparingOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchPreparingOrders])

  async function claimOrder(order: Order) {
    try {
      const { error } = await supabase.rpc('claim_order_as_cook', { p_order_id: order.id })
      if (error) {
        alert('Failed to claim order: ' + error.message)
      } else {
        fetchPreparingOrders()
      }
    } catch (e) {
      console.error(e)
    }
  }

  async function completeOrder(order: Order) {
    try {
      const { error } = await supabase.rpc('complete_order_as_cook', { p_order_id: order.id })
      if (error) {
        alert('Failed to mark ready: ' + error.message)
      } else {
        fetchPreparingOrders()
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Kitchen Display System (KDS)</h1>
            <p className="text-gray-400 mt-1">Orders currently preparing</p>
          </div>
          <button 
            onClick={fetchPreparingOrders}
            disabled={loading}
            className="bg-surface hover:bg-surface-border border border-surface-border text-white px-5 py-2.5 rounded-lg shadow-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : '🔄 Refresh Queue'}
          </button>
        </div>

        {loading && orders.length === 0 ? (
          <div className="flex justify-center my-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-indigo"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {orders.map((order) => {
              const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
              const orderNumber = order.daily_number
                ? `${order.is_priority ? 'R' : 'W'}${order.daily_number}`
                : `#${order.id.slice(0, 6)}`
              
              const isClaimedByMe = order.claimed_by_cook_id === userId
              const isClaimedByOther = order.claimed_by_cook_id != null && !isClaimedByMe
              
              return (
                <div key={order.id} className={`bg-gray-900/80 border ${isClaimedByMe ? 'border-accent-indigo' : 'border-gray-800'} rounded-xl p-5 shadow-lg flex flex-col ${isClaimedByOther ? 'opacity-50 grayscale' : ''}`}>
                  <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-800">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-white font-mono">{orderNumber}</span>
                      {order.is_priority && (
                        <span className="px-2 py-1 rounded text-xs uppercase font-bold bg-amber-500/20 text-amber-400 tracking-wider border border-amber-500/30">
                          Priority
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${elapsed > 15 ? 'text-red-400' : 'text-gray-400'}`}>
                      {elapsed}m ago
                    </span>
                  </div>
                  
                  <ul className="text-sm text-gray-300 space-y-2 mb-6 flex-1">
                    {order.order_items?.map((item, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="font-bold text-accent-indigo bg-accent-indigo/10 px-2 rounded min-w-[32px] text-center">
                          {item.quantity}x
                        </span>
                        <span className="font-medium text-lg text-gray-100">{item.menu_items?.name}</span>
                      </li>
                    ))}
                    {(!order.order_items || order.order_items.length === 0) && (
                      <li className="text-gray-500 italic">No items found</li>
                    )}
                  </ul>
                  
                  {!order.claimed_by_cook_id && (
                    <button 
                      onClick={() => claimOrder(order)}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(79,70,229,0.3)] text-lg"
                    >
                      Claim Order
                    </button>
                  )}
                  {isClaimedByMe && (
                    <button 
                      onClick={() => completeOrder(order)}
                      className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors shadow-[0_0_15px_rgba(22,163,74,0.3)] text-lg"
                    >
                      Mark Ready
                    </button>
                  )}
                  {isClaimedByOther && (
                    <button 
                      disabled
                      className="w-full py-3 bg-gray-800 text-gray-400 font-bold rounded-lg cursor-not-allowed text-lg"
                    >
                      Claimed by another Cook
                    </button>
                  )}
                </div>
              )
            })}
            
            {orders.length === 0 && !loading && (
              <div className="col-span-full bg-surface border border-surface-border rounded-xl p-12 text-center">
                <span className="text-5xl mb-4 block">🍽️</span>
                <h3 className="text-xl font-medium text-white mb-1">Queue is empty</h3>
                <p className="text-gray-400">No orders are currently preparing.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}