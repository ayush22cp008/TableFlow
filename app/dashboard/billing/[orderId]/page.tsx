'use client'

/**
 * CP5: Billing page — itemized bill + optional service charge
 * Accessible via /dashboard/billing/[orderId]
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { OrderWithItems } from '@/types'
import Navbar from '@/components/Navbar'
import OrderStatusBadge from '@/components/OrderStatusBadge'
import { PageLoader } from '@/components/LoadingSpinner'
import { useParams, useRouter } from 'next/navigation'

const SERVICE_CHARGE_RATE = 0.10  // 10%

export default function BillingPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.orderId as string
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [serviceCharge, setServiceCharge] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!orderId || orderId === 'demo') {
      setLoading(false)
      return
    }
    supabase
      .from('orders')
      .select('*, order_items(*, menu_items(*))')
      .eq('id', orderId)
      .single()
      .then(({ data }) => {
        setOrder(data as OrderWithItems)
        setServiceCharge(data?.service_charge_applied ?? false)
        setLoading(false)
      })
  }, [orderId])

  const subtotal = order?.subtotal ?? 0
  const serviceAmount = serviceCharge ? subtotal * SERVICE_CHARGE_RATE : 0
  const total = subtotal + serviceAmount

  async function generateBill() {
    if (!order) return
    setGenerating(true)

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

    await supabase.from('orders').update({
      status: 'billed',
      service_charge_applied: serviceCharge,
      service_charge_amount: serviceAmount,
      total,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id)
    
    setGenerating(false)
    router.push('/dashboard/orders')
  }

  if (loading) return <PageLoader />

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-20 text-center text-gray-400">
          <div className="text-4xl mb-3">🧾</div>
          <p>This is the billing page. Navigate here from a served order in <a href="/dashboard/orders" className="text-indigo-400 underline">Live Orders</a>.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Bill</h1>
          <OrderStatusBadge status={order.status} />
        </div>

        {/* Order items */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden mb-4">
          <div className="px-5 py-3 border-b border-gray-800 text-sm font-medium text-gray-400 flex justify-between">
            <span>Item</span>
            <span>Amount</span>
          </div>
          {order.order_items.map((item) => (
            <div key={item.id} className="px-5 py-3 flex items-center justify-between border-b border-gray-800/50 last:border-0">
              <div>
                <p className="text-white text-sm font-medium">{item.menu_items.name}</p>
                <p className="text-gray-400 text-xs">₹{item.unit_price.toFixed(2)} × {item.quantity}</p>
              </div>
              <span className="text-white font-medium">₹{item.item_total.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal</span>
            <span className="text-white">₹{subtotal.toFixed(2)}</span>
          </div>

          {/* Service charge toggle */}
          <div className="flex items-center justify-between py-2 border-y border-gray-800">
            <div>
              <p className="text-sm text-gray-300">Service Charge (10%)</p>
              <p className="text-xs text-gray-500">Optional — unchecked by default</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={serviceCharge} onChange={(e) => setServiceCharge(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-700 peer-checked:bg-indigo-600 rounded-full peer transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
            </label>
          </div>

          {serviceCharge && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Service Charge</span>
              <span className="text-yellow-400">+ ₹{serviceAmount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-lg font-bold border-t border-gray-700 pt-3">
            <span>Total</span>
            <span className="text-indigo-400">₹{total.toFixed(2)}</span>
          </div>
        </div>

        {order.status !== 'billed' && (
          <button
            onClick={generateBill}
            disabled={generating}
            className="w-full mt-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all disabled:opacity-50"
          >
            {generating ? 'Generating...' : '✓ Generate Bill & Mark as Billed'}
          </button>
        )}
      </main>
    </div>
  )
}
