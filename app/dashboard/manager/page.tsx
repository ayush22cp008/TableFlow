'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { Order } from '@/types'
import { formatOrderNumber } from '@/lib/utils'

type ManagerOrder = Order & {
  order_items: { quantity: number; unit_price: number; menu_items: { name: string } }[]
  restaurant_tables?: { table_number: number }
  cook?: { staff_name: string | null; email: string } | null;
  waiter?: { staff_name: string | null; email: string } | null;
}

export default function ManagerDashboardPage() {
  const [placedOrders, setPlacedOrders] = useState<ManagerOrder[]>([])
  const [preparingOrders, setPreparingOrders] = useState<ManagerOrder[]>([])
  const [readyOrders, setReadyOrders] = useState<ManagerOrder[]>([])
  const [servedOrders, setServedOrders] = useState<ManagerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [paymentMethods, setPaymentMethods] = useState<Record<string, string>>({})

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    
    const { data: placedData } = await supabase
      .from('orders')
      .select('*, order_items(quantity, unit_price, menu_items(name)), restaurant_tables(table_number), cook:profiles!claimed_by_cook_id(staff_name, email), waiter:profiles!claimed_by_waiter_id(staff_name, email)')
      .eq('status', 'placed')
      .order('is_priority', { ascending: false })
      .order('created_at', { ascending: true })

    const { data: preparingData } = await supabase
      .from('orders')
      .select('*, order_items(quantity, unit_price, menu_items(name)), restaurant_tables(table_number), cook:profiles!claimed_by_cook_id(staff_name, email), waiter:profiles!claimed_by_waiter_id(staff_name, email)')
      .eq('status', 'preparing')
      .order('is_priority', { ascending: false })
      .order('created_at', { ascending: true })

    const { data: readyData } = await supabase
      .from('orders')
      .select('*, order_items(quantity, unit_price, menu_items(name)), restaurant_tables(table_number), cook:profiles!claimed_by_cook_id(staff_name, email), waiter:profiles!claimed_by_waiter_id(staff_name, email)')
      .eq('status', 'ready')
      .order('is_priority', { ascending: false })
      .order('created_at', { ascending: true })

    const { data: servedData } = await supabase
      .from('orders')
      .select('*, order_items(quantity, unit_price, menu_items(name)), restaurant_tables(table_number), cook:profiles!claimed_by_cook_id(staff_name, email), waiter:profiles!claimed_by_waiter_id(staff_name, email)')
      .eq('status', 'served')
      .order('is_priority', { ascending: false })
      .order('created_at', { ascending: true })
    
    setPlacedOrders((placedData as unknown as ManagerOrder[]) ?? [])
    setPreparingOrders((preparingData as unknown as ManagerOrder[]) ?? [])
    setReadyOrders((readyData as unknown as ManagerOrder[]) ?? [])
    setServedOrders((servedData as unknown as ManagerOrder[]) ?? [])
    
    // Initialize payment methods for served orders if not already set
    setPaymentMethods(prev => {
      let changed = false
      const next = { ...prev }
      servedData?.forEach(order => {
        if (!next[order.id]) {
          next[order.id] = 'cash'
          changed = true
        }
      })
      return changed ? next : prev
    })
    
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchOrders()
    
    const channel = supabase.channel('manager_dashboard_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders])

  async function markPreparing(orderId: string) {
    await supabase.from('orders').update({ 
      status: 'preparing', 
      updated_at: new Date().toISOString() 
    }).eq('id', orderId)
    
    fetchOrders()
  }

  async function markPaid(orderId: string) {
    await supabase.from('orders').update({ 
      status: 'billed', 
      updated_at: new Date().toISOString() 
    }).eq('id', orderId)
    
    fetchOrders()
  }

  const printBill = () => {
    window.print()
  }

  // Calculate order total
  const calculateTotal = (items: ManagerOrder['order_items'] = []) => {
    return items.reduce((acc, item) => acc + (item.quantity * (item.unit_price || 0)), 0)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 print-hidden">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Manager Dashboard</h1>
            <p className="text-gray-400 mt-1">Intake, Kitchen, Waiter, and Billing Queues</p>
          </div>
          <button 
            onClick={fetchOrders}
            disabled={loading}
            className="bg-surface hover:bg-surface-border border border-surface-border text-white px-5 py-2.5 rounded-lg shadow-sm transition flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : '🔄 Refresh View'}
          </button>
        </div>

        {loading && placedOrders.length === 0 && servedOrders.length === 0 && preparingOrders.length === 0 && readyOrders.length === 0 ? (
          <div className="flex justify-center my-20 print-hidden">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent-indigo"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* INTAKE QUEUE */}
            <div className="print-hidden">
              <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-2">
                <span className="bg-indigo-600 w-3 h-8 rounded-sm inline-block"></span>
                Intake Queue (Placed)
              </h2>
              <div className="space-y-4">
                {placedOrders.length === 0 && (
                   <div className="bg-surface border border-surface-border rounded-xl p-8 text-center text-gray-400">
                     No new orders.
                   </div>
                )}
                {placedOrders.map(order => (
                  <div key={order.id} className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-lg font-bold text-white">Order {formatOrderNumber(order)}</div>
                        {order.restaurant_tables?.table_number && (
                          <div className="text-indigo-400 font-medium">Table {order.restaurant_tables.table_number}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-400">${calculateTotal(order.order_items).toFixed(2)}</div>
                      </div>
                    </div>
                    
                    <ul className="text-sm text-gray-300 space-y-1 mb-6 border-t border-gray-800 pt-4">
                      {order.order_items?.map((item, i: number) => (
                        <li key={i} className="flex justify-between">
                          <span>{item.quantity}x {item.menu_items?.name}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <button 
                      onClick={() => markPreparing(order.id)}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors"
                    >
                      Accept (Send to Kitchen)
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* IN PROGRESS (PREPARING) QUEUE */}
            <div className="print-hidden">
              <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-2">
                <span className="bg-amber-500 w-3 h-8 rounded-sm inline-block"></span>
                In Progress (Preparing)
              </h2>
              <div className="space-y-4">
                {preparingOrders.length === 0 && (
                   <div className="bg-surface border border-surface-border rounded-xl p-8 text-center text-gray-400">
                     No orders currently preparing.
                   </div>
                )}
                {preparingOrders.map(order => (
                  <div key={order.id} className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-lg font-bold text-white">Order {formatOrderNumber(order)}</div>
                        {order.restaurant_tables?.table_number && (
                          <div className="text-indigo-400 font-medium">Table {order.restaurant_tables.table_number}</div>
                        )}
                        {order.cook?.staff_name ? (
                          <div className="text-sm text-amber-300 mt-1">Cook: {order.cook.staff_name} ({order.cook.email})</div>
                        ) : (
                          <div className="text-sm text-gray-400 mt-1 italic">Unclaimed (Waiting for Cook)</div>
                        )}
                      </div>
                    </div>
                    
                    <ul className="text-sm text-gray-300 space-y-1 pt-4 border-t border-gray-800">
                      {order.order_items?.map((item, i: number) => (
                        <li key={i} className="flex justify-between">
                          <span>{item.quantity}x {item.menu_items?.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* READY (WAITING FOR WAITER) QUEUE */}
            <div className="print-hidden">
              <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-2">
                <span className="bg-blue-500 w-3 h-8 rounded-sm inline-block"></span>
                Ready (Waiting for Waiter)
              </h2>
              <div className="space-y-4">
                {readyOrders.length === 0 && (
                   <div className="bg-surface border border-surface-border rounded-xl p-8 text-center text-gray-400">
                     No orders ready to serve.
                   </div>
                )}
                {readyOrders.map(order => (
                  <div key={order.id} className="bg-gray-900/80 border border-gray-800 rounded-xl p-5 shadow-lg">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="text-lg font-bold text-white">Order {formatOrderNumber(order)}</div>
                        {order.restaurant_tables?.table_number && (
                          <div className="text-indigo-400 font-medium">Table {order.restaurant_tables.table_number}</div>
                        )}
                        {order.waiter?.staff_name ? (
                          <div className="text-sm text-blue-300 mt-1">Waiter: {order.waiter.staff_name} ({order.waiter.email})</div>
                        ) : (
                          <div className="text-sm text-gray-400 mt-1 italic">Unclaimed (Waiting for Waiter)</div>
                        )}
                      </div>
                    </div>
                    
                    <ul className="text-sm text-gray-300 space-y-1 pt-4 border-t border-gray-800">
                      {order.order_items?.map((item, i: number) => (
                        <li key={i} className="flex justify-between">
                          <span>{item.quantity}x {item.menu_items?.name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* BILLING QUEUE */}
            <div>
              <h2 className="text-2xl font-bold mb-4 text-white flex items-center gap-2 print-hidden">
                <span className="bg-green-600 w-3 h-8 rounded-sm inline-block"></span>
                Billing Queue (Served)
              </h2>
              <div className="space-y-6">
                {servedOrders.length === 0 && (
                   <div className="bg-surface border border-surface-border rounded-xl p-8 text-center text-gray-400 print-hidden">
                     No orders pending payment.
                   </div>
                )}
                {servedOrders.map(order => {
                  const total = calculateTotal(order.order_items);
                  
                  return (
                    <div key={order.id} className="bg-gray-900/80 border border-gray-800 rounded-xl p-6 shadow-lg print-break-inside-avoid print-bg-white print-border-black print-shadow-none print:mb-8 print:p-0">
                      <div className="text-center mb-6 pb-4 border-b border-gray-800 print-border-black">
                        <h3 className="text-xl font-bold text-white print-text-black">TableFlow Receipt</h3>
                        <div className="text-gray-400 print-text-black">Order {formatOrderNumber(order)}</div>
                        {order.restaurant_tables?.table_number && (
                          <div className="text-indigo-400 font-medium font-mono text-lg mt-1 print-text-black">Table {order.restaurant_tables.table_number}</div>
                        )}
                        {/* We don't need cook/waiter on the final printed bill since it's cleared, but we can show it if it were present */}
                      </div>
                      
                      <div className="mb-6">
                        <div className="grid grid-cols-12 text-xs uppercase font-bold text-gray-500 pb-2 border-b border-gray-800 mb-2 print-text-black print-border-black">
                          <div className="col-span-6">Item</div>
                          <div className="col-span-2 text-center">Qty</div>
                          <div className="col-span-2 text-right">Price</div>
                          <div className="col-span-2 text-right">Total</div>
                        </div>
                        <ul className="text-sm text-gray-300 space-y-2 print-text-black">
                          {order.order_items?.map((item, i: number) => {
                            const lineTotal = item.quantity * (item.unit_price || 0);
                            return (
                              <li key={i} className="grid grid-cols-12 items-center">
                                <span className="col-span-6 font-medium truncate pr-2">{item.menu_items?.name}</span>
                                <span className="col-span-2 text-center">{item.quantity}</span>
                                <span className="col-span-2 text-right text-gray-400 print-text-black">${(item.unit_price || 0).toFixed(2)}</span>
                                <span className="col-span-2 text-right font-medium">${lineTotal.toFixed(2)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      
                      <div className="flex justify-between items-center pt-4 border-t border-gray-800 mb-6 print-border-black">
                        <span className="text-lg font-bold text-white print-text-black">Grand Total</span>
                        <span className="text-2xl font-bold text-green-400 print-text-black">${total.toFixed(2)}</span>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 print-hidden">
                        <select 
                          className="bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
                          value={paymentMethods[order.id] || 'cash'}
                          onChange={(e) => setPaymentMethods({...paymentMethods, [order.id]: e.target.value})}
                        >
                          <option value="cash">Cash</option>
                          <option value="card">Card</option>
                          <option value="upi">UPI</option>
                        </select>
                        <button 
                          onClick={() => markPaid(order.id)}
                          className="bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg py-2 transition-colors"
                        >
                          Mark Paid
                        </button>
                        <button 
                          onClick={() => printBill()}
                          className="bg-gray-800 hover:bg-gray-700 text-white font-medium border border-gray-700 rounded-lg py-2 transition-colors flex items-center justify-center gap-2"
                        >
                          🖨️ Print PDF
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
          </div>
        )}
      </main>
    </div>
  )
}