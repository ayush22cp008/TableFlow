'use client'

/**
 * CP4: Cart page — review items, place order
 * Auto-allocates best-fit available table by party size.
 * Falls back to waitlist if no suitable table is available.
 * Displays waitlist status to customer on load.
 */

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'
import { CartItem } from '@/types'
import Navbar from '@/components/Navbar'
import { useRouter } from 'next/navigation'

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem('tableflow_cart') || '[]')
  } catch { return [] }
}

export default function CartPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [partySize, setPartySize] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [maxCapacity, setMaxCapacity] = useState(4)

  const [reservationCode, setReservationCode] = useState('')
  const [verifiedReservation, setVerifiedReservation] = useState<{ id: string; table_id: string; party_size: number; table_number?: number } | null>(null)
  const [verifyingCode, setVerifyingCode] = useState(false)
  
  // Waitlist state
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [waitlistEntry, setWaitlistEntry] = useState<any>(null)

  useEffect(() => { 
    setCart(loadCart()) 
    supabase.from('restaurant_tables').select('capacity').then(({ data }) => {
      if (data && data.length > 0) {
        setMaxCapacity(Math.max(...data.map(t => t.capacity)))
      }
    })
  }, [])

  useEffect(() => {
    async function checkWaitlist() {
      if (!user) return
      const { data } = await supabase
        .from('waitlist')
        .select('*, restaurant_tables(table_number)')
        .eq('customer_id', user.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .single()
      
      if (data) {
        // Do not show if the user already acknowledged/cleared this specific entry
        if (localStorage.getItem(`tableflow_waitlist_cleared_${data.id}`)) {
          return
        }
        setWaitlistEntry(data)
      }
    }
    checkWaitlist()
  }, [user])

  const subtotal = cart.reduce((sum, c) => sum + c.menuItem.price * c.quantity, 0)

  async function verifyReservationCode() {
    if (!reservationCode) return
    setVerifyingCode(true)
    setError(null)
    const { data, error } = await supabase
      .from('reservation_requests')
      .select('id, table_id, party_size, restaurant_tables(table_number)')
      .eq('unique_code', reservationCode)
      .eq('status', 'arrived')
      .limit(1)
      .single()

    if (error || !data || !data.table_id) {
      setError('Invalid or unused code, or missing table assignment.')
      setVerifyingCode(false)
      return
    }

    setVerifiedReservation({ 
      id: data.id, 
      table_id: data.table_id, 
      party_size: data.party_size,
      // @ts-expect-error - Ignore relation type for table_number
      table_number: data.restaurant_tables?.table_number 
    })
    setPartySize(data.party_size)
    setVerifyingCode(false)
  }

  // Normal flow order placement
  async function placeOrder() {
    if (!user) { router.push('/login'); return }
    if (cart.length === 0) return
    setLoading(true)
    setError(null)
    setSuccessMessage(null)

    let assignedTableId = null
    let assignedTableNum = null

    if (verifiedReservation) {
      assignedTableId = verifiedReservation.table_id
      assignedTableNum = verifiedReservation.table_number
    } else {
      // Step 1: Find best-fit available table (smallest table with enough seats)
      const { data: tables, error: tableErr } = await supabase
        .from('restaurant_tables')
        .select('id, table_number, capacity, occupied_seats, reserved_from')
        .neq('status', 'reserved')
        .order('capacity', { ascending: true })

      if (tableErr) {
        setError('Could not check table availability. Please try again.')
        setLoading(false)
        return
      }

      const now = Date.now()
      const validTables = (tables || []).filter(t => {
        if (t.reserved_from && now >= new Date(t.reserved_from).getTime() - 30 * 60 * 1000) return false
        return (t.capacity - (t.occupied_seats || 0)) >= partySize
      })
      const assignedTable = validTables.length > 0 ? validTables[0] : null
      
      if (assignedTable) {
        assignedTableId = assignedTable.id
        assignedTableNum = assignedTable.table_number
      }
    }

    // Step 2a: Table found — place the order and mark table occupied
    if (assignedTableId) {
      const { data: orderId, error: rpcError } = await supabase.rpc(
        'place_order_and_occupy_table',
        {
          p_customer_id: user.id,
          p_table_id: assignedTableId,
          p_subtotal: subtotal,
          p_total: subtotal,
          p_party_size: verifiedReservation ? verifiedReservation.party_size : partySize
        }
      )

      if (rpcError || !orderId) {
        setError(rpcError?.message ?? 'Failed to place order and allocate table')
        setLoading(false)
        return
      }

      // Insert order items
      const items = cart.map((c) => ({
        order_id: orderId,
        menu_item_id: c.menuItem.id,
        quantity: c.quantity,
        unit_price: c.menuItem.price,
        item_total: c.menuItem.price * c.quantity,
        notes: c.notes ?? null,
      }))

      const { error: itemsErr } = await supabase.from('order_items').insert(items)
      if (itemsErr) {
        setError(itemsErr.message)
        setLoading(false)
        return
      }

      if (verifiedReservation) {
        await supabase.from('reservation_requests').update({ status: 'completed' }).eq('id', verifiedReservation.id)
        await supabase.from('restaurant_tables').update({ reserved_from: null }).eq('id', assignedTableId)
      }

      // Clear cart and show confirmation
      localStorage.removeItem('tableflow_cart')
      setSuccessMessage(`You've been seated at Table ${assignedTableNum || 'assigned'}!`)
      setLoading(false)

      // Redirect after 2s so user can read the message
      setTimeout(() => router.push('/order/my-orders'), 2000)
      return
    }

    // Step 2b: No table available — add to waitlist (no order created)
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const customerName = profile?.email ?? 'Guest'

    const { data: insertedWaitlist, error: waitlistErr } = await supabase.from('waitlist').insert({
      customer_id: user.id,
      customer_name: customerName,
      party_size: partySize,
      table_id: null,
      status: 'waiting',
    }).select().single()

    if (waitlistErr) {
      setError('Failed to add to waitlist: ' + waitlistErr.message)
      setLoading(false)
      return
    }

    // Update local state to immediately show waitlist UI
    setWaitlistEntry(insertedWaitlist)
    setLoading(false)
  }

  // Waitlist flow order placement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function placeOrderFromWaitlist(entry: any) {
    if (!user) { router.push('/login'); return }
    if (cart.length === 0) return
    setLoading(true)
    setError(null)

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        table_id: entry.table_id,
        subtotal,
        total: subtotal,
        status: 'placed',
        party_size: entry.party_size,
      })
      .select()
      .single()

    if (orderErr || !order) {
      setError(orderErr?.message ?? 'Failed to place order')
      setLoading(false)
      return
    }

    const items = cart.map((c) => ({
      order_id: order.id,
      menu_item_id: c.menuItem.id,
      quantity: c.quantity,
      unit_price: c.menuItem.price,
      item_total: c.menuItem.price * c.quantity,
      notes: c.notes ?? null,
    }))

    const { error: itemsErr } = await supabase.from('order_items').insert(items)
    if (itemsErr) {
      setError(itemsErr.message)
      setLoading(false)
      return
    }

    // Clear cart, mark waitlist entry as acknowledged, and show success
    localStorage.removeItem('tableflow_cart')
    localStorage.setItem(`tableflow_waitlist_cleared_${entry.id}`, 'true')
    setWaitlistEntry(null)
    setSuccessMessage(`Order placed successfully for Table ${entry.restaurant_tables?.table_number ?? 'assigned'}!`)
    setLoading(false)

    setTimeout(() => router.push('/order/my-orders'), 2000)
  }

  // Waitlist Status Screens
  if (waitlistEntry && !successMessage) {
    if (waitlistEntry.status === 'waiting') {
      return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
          <Navbar />
          <main className="max-w-2xl mx-auto px-4 py-10">
            <div className="text-center py-20">
              <div className="text-5xl mb-4">⏳</div>
              <p className="text-xl font-semibold text-yellow-400">
                No table available right now. You&apos;ve been added to the waitlist.
              </p>
              <button
                onClick={() => router.push('/order')}
                className="mt-6 px-6 py-2.5 bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-card shadow-card transition-all font-medium"
              >
                Back to Menu
              </button>
            </div>
          </main>
        </div>
      )
    }

    if (waitlistEntry.status === 'seated') {
      return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
          <Navbar />
          <main className="max-w-2xl mx-auto px-4 py-10">
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🎉</div>
              <p className="text-xl font-semibold text-green-400">
                Your table is ready! Table {waitlistEntry.restaurant_tables?.table_number}
              </p>
              
              {error && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm max-w-md mx-auto">
                  {error}
                </div>
              )}

              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={() => router.push('/order')}
                  className="px-6 py-2.5 border border-gray-600 text-gray-300 hover:bg-gray-800 rounded-card shadow-card transition-all font-medium"
                >
                  Edit Order
                </button>

                <button
                  onClick={() => placeOrderFromWaitlist(waitlistEntry)}
                  disabled={loading || cart.length === 0}
                  className="px-6 py-2.5 bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-card shadow-card transition-all font-medium disabled:opacity-50"
                >
                  {loading ? 'Placing Order...' : (cart.length === 0 ? 'Cart Empty - Go to Menu' : 'Place Order Now')}
                </button>
              </div>
              
              {cart.length === 0 && (
                <div className="mt-4">
                  <button onClick={() => router.push('/order')} className="text-indigo-400 text-sm hover:underline">
                    Back to Menu
                  </button>
                </div>
              )}
            </div>
          </main>
        </div>
      )
    }

    if (waitlistEntry.status === 'cancelled') {
      return (
        <div className="min-h-screen bg-gray-950 text-gray-100">
          <Navbar />
          <main className="max-w-2xl mx-auto px-4 py-10">
            <div className="text-center py-20">
              <div className="text-5xl mb-4">⚠️</div>
              <p className="text-xl font-semibold text-red-400 mb-6">
                Your waitlist request was cancelled by the restaurant. Please try again or contact staff.
              </p>
              <button
                onClick={() => {
                  localStorage.removeItem('tableflow_cart')
                  localStorage.setItem(`tableflow_waitlist_cleared_${waitlistEntry.id}`, 'true')
                  setWaitlistEntry(null)
                  router.push('/order')
                }}
                className="px-6 py-2.5 bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-card shadow-card transition-all font-medium"
              >
                Back to Menu
              </button>
            </div>
          </main>
        </div>
      )
    }
  }

  // Confirmation screen — shown after direct success (table found immediately or waitlist order placed)
  if (successMessage) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 py-10">
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎉</div>
            <p className="text-xl font-semibold text-green-400">
              {successMessage}
            </p>
            <p className="text-gray-400 mt-2 text-sm">Redirecting to your orders...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">Your Cart</h1>

        {cart.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-4xl mb-3">🛒</div>
            <p>Your cart is empty</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map(({ menuItem, quantity }) => (
              <div key={menuItem.id} className="flex items-center justify-between p-4 bg-surface border border-surface-border rounded-card shadow-card">
                <div>
                  <p className="font-medium text-white">{menuItem.name}</p>
                  <p className="text-sm text-accent-amber">₹{menuItem.price.toFixed(2)} × {quantity}</p>
                </div>
                <span className="text-accent-amber font-semibold">₹{(menuItem.price * quantity).toFixed(2)}</span>
              </div>
            ))}

            <div className="border-t border-gray-800 pt-4 flex justify-between text-lg font-bold">
              <span>Subtotal</span>
              <span className="text-accent-amber">₹{subtotal.toFixed(2)}</span>
            </div>

            {/* Reservation Code */}
            <div className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-card shadow-card">
              <label className="block text-sm font-medium text-gray-300 mb-2">Have a reservation code?</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. 123456"
                  value={reservationCode}
                  onChange={(e) => setReservationCode(e.target.value)}
                  disabled={!!verifiedReservation}
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                />
                {!verifiedReservation ? (
                  <button onClick={verifyReservationCode} disabled={!reservationCode || verifyingCode} className="px-4 py-2 bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    Verify
                  </button>
                ) : (
                  <button onClick={() => { setVerifiedReservation(null); setReservationCode(''); }} className="px-4 py-2 bg-transparent border border-surface-border text-text-secondary hover:bg-surface rounded-lg text-sm font-medium">
                    Clear
                  </button>
                )}
              </div>
              {verifiedReservation && (
                <p className="mt-2 text-sm text-green-400">✓ Code applied. Table {verifiedReservation.table_number} assigned.</p>
              )}
            </div>

            {/* Party Size input — used for auto table allocation */}
            <div className="mt-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Party Size
                <span className="ml-1 text-gray-500 font-normal">(used to find your table)</span>
              </label>
              <input
                type="number"
                value={partySize}
                min={1}
                max={maxCapacity}
                disabled={!!verifiedReservation}
                onChange={(e) => setPartySize(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-card shadow-card text-white outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
              {partySize > maxCapacity && (
                <p className="mt-2 text-sm text-red-400">
                  Sorry, we can&apos;t seat a party of {partySize}. Our largest table seats {maxCapacity}.
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm">{error}</div>
            )}

            <button
              onClick={placeOrder}
              disabled={loading || partySize > maxCapacity}
              className="w-full py-3 bg-accent-indigo hover:bg-accent-indigo-hover text-white font-medium rounded-card shadow-card transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Finding your table...' : '✓ Place Order'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
