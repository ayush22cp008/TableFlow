'use client'

/**
 * CP3: Tables + Waitlist management (owner)
 * - Grid of restaurant tables with status
 * - Waitlist queue with seat/cancel actions
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { RestaurantTable, WaitlistEntry, ReservationRequest, Order } from '@/types'
import Navbar from '@/components/Navbar'
import { PageLoader } from '@/components/LoadingSpinner'
import { useAuth } from '@/lib/AuthContext'



function getTableDisplay(table: RestaurantTable) {
  if (table.reserved_from) {
    const reservedTime = new Date(table.reserved_from).getTime()
    if (Date.now() >= reservedTime - 30 * 60 * 1000) {
      return { 
        colorClasses: 'bg-purple-500/20 border-purple-500/40 text-purple-300', 
        label: `Reserved for ${new Date(table.reserved_from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` 
      }
    }
  }

  if (table.status === 'reserved') {
    return { colorClasses: 'bg-purple-500/20 border-purple-500/40 text-purple-300', label: 'Reserved' }
  } else if ((table.occupied_seats || 0) === 0) {
    return { colorClasses: 'bg-green-500/20 border-green-500/40 text-green-300', label: 'Available' }
  } else if ((table.occupied_seats || 0) < table.capacity) {
    return { colorClasses: 'bg-orange-500/20 border-orange-500/40 text-orange-300', label: 'Partially Occupied' }
  } else {
    return { colorClasses: 'bg-red-500/20 border-red-500/40 text-red-300', label: 'Full' }
  }
}

export default function TablesPage() {
  const { role } = useAuth()
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [reservationRequests, setReservationRequests] = useState<ReservationRequest[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTable, setShowAddTable] = useState(false)
  const [newTableNum, setNewTableNum] = useState('')
  const [newCapacity, setNewCapacity] = useState('4')
  
  const [showReserveTable, setShowReserveTable] = useState<RestaurantTable | null>(null)
  const [reservationTime, setReservationTime] = useState('')

  const fetchData = useCallback(async () => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [{ data: t }, { data: w }, { data: r }, { data: o }] = await Promise.all([
      supabase.from('restaurant_tables').select('*').order('table_number'),
      supabase.from('waitlist').select('*').eq('status', 'waiting').order('joined_at'),
      supabase.from('reservation_requests')
        .select('*')
        .in('status', ['pending', 'approved', 'completed'])
        .gte('requested_time', startOfToday.toISOString())
        .order('requested_time'),
      supabase.from('orders').select('*')
    ])
    setTables((t as RestaurantTable[]) ?? [])
    setWaitlist((w as WaitlistEntry[]) ?? [])
    setReservationRequests((r as ReservationRequest[]) ?? [])
    setOrders((o as Order[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const channel = supabase.channel('tables_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_requests' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  async function cycleTableStatus(table: RestaurantTable) {
    const next = table.status === 'reserved' ? 'available' : 'reserved'
    const { error } = await supabase.from('restaurant_tables').update({ status: next }).eq('id', table.id)
    if (error) {
      window.alert('Failed to update table status: ' + error.message)
      return
    }
    fetchData()
  }

  async function setReservation() {
    if (!showReserveTable || !reservationTime) return
    const { error } = await supabase.from('restaurant_tables').update({ reserved_from: new Date(reservationTime).toISOString() }).eq('id', showReserveTable.id)
    if (error) {
      window.alert('Failed to set reservation: ' + error.message)
      return
    }
    setShowReserveTable(null)
    setReservationTime('')
    fetchData()
  }

  async function clearReservation(table: RestaurantTable) {
    // 1. Mark related approved reservation requests as cancelled
    await supabase.from('reservation_requests')
      .update({ status: 'cancelled' })
      .eq('table_id', table.id)
      .eq('status', 'approved')

    const { error } = await supabase.from('restaurant_tables').update({ reserved_from: null }).eq('id', table.id)
    if (error) {
      window.alert('Failed to clear reservation: ' + error.message)
      return
    }
    fetchData()
  }

  const [codeInputs, setCodeInputs] = useState<Record<string, string>>({})

  async function approveRequest(req: ReservationRequest, tableId: string) {
    if (!tableId) { window.alert('Select a table first'); return }

    const targetTable = tables.find(t => t.id === tableId)
    if (!targetTable) { window.alert('Invalid table'); return }
    
    // Occupancy check
    if ((targetTable.capacity - (targetTable.occupied_seats || 0)) < req.party_size) {
      window.alert('Not enough available seats on this table.')
      return
    }

    // Overlap check
    const hasOverlap = reservationRequests.some(r => 
      r.status === 'approved' && 
      r.table_id === tableId && 
      r.id !== req.id
    )
    if (hasOverlap) {
      window.alert('This table already has an active reservation assigned.')
      return
    }

    const uniqueCode = Math.floor(100000 + Math.random() * 900000).toString()
    
    const { error: reqErr } = await supabase.from('reservation_requests')
      .update({ status: 'approved', unique_code: uniqueCode, table_id: tableId })
      .eq('id', req.id)
    
    if (reqErr) { window.alert('Error approving request: ' + reqErr.message); return }

    await supabase.from('restaurant_tables').update({ reserved_from: req.requested_time }).eq('id', tableId)
    fetchData()
  }

  async function rejectRequest(req: ReservationRequest) {
    await supabase.from('reservation_requests').update({ status: 'rejected' }).eq('id', req.id)
    fetchData()
  }



  async function seatWaitlistEntry(entry: WaitlistEntry) {
    const { data: tables } = await supabase
      .from('restaurant_tables')
      .select('id, capacity, occupied_seats, reserved_from')
      .neq('status', 'reserved')
      .order('capacity', { ascending: true })

    const now = Date.now()
    const validTables = (tables || []).filter(t => {
      if (t.reserved_from && now >= new Date(t.reserved_from).getTime() - 30 * 60 * 1000) return false
      return (t.capacity - (t.occupied_seats || 0)) >= entry.party_size
    })
    const assignedTable = validTables.length > 0 ? validTables[0] : null

    if (assignedTable) {
      const { error: tableErr } = await supabase.from('restaurant_tables').update({ 
        status: 'occupied',
        occupied_seats: (assignedTable.occupied_seats || 0) + entry.party_size
      }).eq('id', assignedTable.id)
      if (tableErr) {
        window.alert('Failed to update table status: ' + tableErr.message)
        return
      }

      const { error: wlErr } = await supabase.from('waitlist').update({ 
        status: 'seated', 
        seated_at: new Date().toISOString(),
        table_id: assignedTable.id 
      }).eq('id', entry.id)
      
      if (wlErr) {
        window.alert('Failed to update waitlist entry: ' + wlErr.message)
        return
      }

      fetchData()
    } else {
      window.alert('No available table fits this party size right now.')
    }
  }

  async function cancelWaitlistEntry(entry: WaitlistEntry) {
    if (!window.confirm("Cancel this customer's waitlist entry?")) return
    const { error } = await supabase.from('waitlist').update({ status: 'cancelled' }).eq('id', entry.id)
    if (error) {
      window.alert('Failed to cancel waitlist entry: ' + error.message)
      return
    }
    fetchData()
  }

  async function addTable() {
    if (!newTableNum) return
    const { error } = await supabase.from('restaurant_tables').insert({ table_number: parseInt(newTableNum), capacity: parseInt(newCapacity) || 4 })
    if (error) {
      window.alert('Failed to add table: ' + error.message)
      return
    }
    setShowAddTable(false)
    setNewTableNum('')
    setNewCapacity('4')
    fetchData()
  }

  const now = Date.now()
  const visibleReservations = reservationRequests.filter(req => {
    if (req.status === 'pending') return true
    
    if (req.status === 'approved' || req.status === 'completed') {
      const requestedTime = new Date(req.requested_time).getTime()
      
      const linkedOrder = [...orders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .find(order => {
          if (order.table_id !== req.table_id) return false
          const orderTime = new Date(order.created_at).getTime()
          return orderTime >= requestedTime - 30 * 60 * 1000 && orderTime <= requestedTime + 30 * 60 * 1000
        })

      if (req.status === 'completed') {
        if (linkedOrder) {
          const seatedTime = new Date(linkedOrder.created_at).getTime()
          return now <= seatedTime + 5 * 60 * 1000
        }
        return now <= requestedTime + 5 * 60 * 1000
      }

      if (linkedOrder) {
        if (linkedOrder.status === 'billed') {
          const billedTime = new Date(linkedOrder.updated_at).getTime()
          return now <= billedTime + 5 * 60 * 1000
        }
        return true
      } else {
        return now <= requestedTime + 30 * 60 * 1000
      }
    }
    return false
  })

  if (loading) return <PageLoader />

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Tables grid */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold">Restaurant Tables</h1>
              <button onClick={() => setShowAddTable(true)} className="px-4 py-2 bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-xl text-sm font-medium">
                + Add Table
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {tables.map((table) => {
                const { colorClasses, label } = getTableDisplay(table)
                return (
                  <div
                    key={table.id}
                    className={`p-5 rounded-xl border-2 transition-all text-center hover:scale-105 cursor-pointer flex flex-col items-center ${colorClasses}`}
                    onClick={() => cycleTableStatus(table)}
                  >
                    <div className="text-3xl mb-1">🪑</div>
                    <div className="font-bold text-lg">Table {table.table_number}</div>
                    <div className="text-sm opacity-80">Seats {table.capacity}</div>
                    <div className="text-xs font-bold text-indigo-300 mt-0.5">{table.occupied_seats || 0}/{table.capacity} seated</div>
                    <div className="text-xs mt-1 font-medium">{label}</div>
                    <div className="text-xs opacity-60 mt-0.5">Click to toggle reserved</div>

                    <div className="flex gap-2 mt-3 w-full" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => setShowReserveTable(table)}
                        className="flex-1 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                      >
                        Reserve
                      </button>
                      {table.reserved_from && (
                        <button 
                          onClick={() => clearReservation(table)}
                          className="flex-1 py-1.5 text-xs bg-red-900/50 hover:bg-red-800 text-red-200 rounded-lg"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {tables.length === 0 && (
                <div className="col-span-3 text-center py-12 text-gray-400">No tables yet. Add your first table.</div>
              )}
            </div>
          </div>

          {/* Waitlist */}
          <div>
            <h2 className="text-xl font-bold mb-4">Waitlist ({waitlist.length})</h2>
            <div className="space-y-3">
              {waitlist.map((entry, i) => (
                <div key={entry.id} className="p-4 bg-surface border border-surface-border rounded-card shadow-card">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="font-medium text-white">{entry.customer_name}</span>
                  </div>
                  <p className="text-sm text-gray-400">Party of {entry.party_size}{entry.phone && ` • ${entry.phone}`}</p>
                  <p className="text-xs text-gray-500 mb-3">{new Date(entry.joined_at).toLocaleTimeString()}</p>
                  <div className="flex gap-2">
                    <button onClick={() => seatWaitlistEntry(entry)} className="flex-1 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg">Seat</button>
                    <button onClick={() => cancelWaitlistEntry(entry)} className="flex-1 py-1.5 text-xs bg-transparent hover:bg-surface border border-surface-border text-text-secondary rounded-lg">Cancel</button>
                  </div>
                </div>
              ))}
              {waitlist.length === 0 && <p className="text-gray-400 text-sm">No one waiting right now.</p>}
            </div>

            {/* Reservation Requests */}
            <h2 className="text-xl font-bold mb-4 mt-8">Reservation Requests ({reservationRequests.length})</h2>
            <div className="space-y-4">
              {/* Pending */}
              {visibleReservations.filter(r => r.status === 'pending').map((req) => (
                <div key={req.id} className="p-4 bg-surface border border-surface-border rounded-card shadow-card">
                  <div className="mb-2">
                    <h3 className="font-bold">{req.customer_name}</h3>
                    <p className="text-sm text-gray-400">Party of {req.party_size} • {new Date(req.requested_time).toLocaleString()}</p>
                  </div>
                  {role === 'manager' && (
                    <>
                      <div className="mb-3">
                        <select
                          onChange={(e) => setCodeInputs({ ...codeInputs, [req.id + '_table']: e.target.value })}
                          className="w-full px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white outline-none"
                        >
                          <option value="">Select Table...</option>
                          {tables.filter(t => (t.capacity - (t.occupied_seats || 0)) >= req.party_size).map(t => (
                            <option key={t.id} value={t.id}>Table {t.table_number} (Seats {t.capacity - (t.occupied_seats || 0)} available)</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => approveRequest(req, codeInputs[req.id + '_table'])} className="flex-1 py-1.5 text-xs bg-green-600 hover:bg-green-500 text-white rounded-lg">Approve</button>
                        <button onClick={() => rejectRequest(req)} className="flex-1 py-1.5 text-xs bg-transparent hover:bg-surface border border-surface-border text-text-secondary rounded-lg">Reject</button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Approved */}
              {visibleReservations.filter(r => r.status === 'approved' || r.status === 'completed').map((req) => (
                <div key={req.id} className="p-4 bg-surface border border-indigo-900/50 rounded-xl">
                  <div className="mb-2 flex justify-between items-start">
                    <div>
                      <h3 className="font-bold">{req.customer_name}</h3>
                      <p className="text-sm text-gray-400">Party of {req.party_size}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs rounded-full font-medium">
                      {req.status === 'completed' ? 'Seated' : 'Approved'}
                    </span>
                  </div>

                </div>
              ))}
              
              {visibleReservations.length === 0 && <p className="text-gray-400 text-sm">No active requests.</p>}
            </div>
          </div>
        </div>

        {/* Add table modal */}
        {showAddTable && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-surface-border rounded-card shadow-card p-6 w-full max-w-sm space-y-4">
              <h2 className="text-xl font-bold">Add Table</h2>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Table Number</label>
                <input type="number" value={newTableNum} onChange={(e) => setNewTableNum(e.target.value)} className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-accent-indigo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Seating Capacity</label>
                <input type="number" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-accent-indigo" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddTable(false)} className="flex-1 py-2.5 bg-transparent hover:bg-surface border border-surface-border text-text-secondary rounded-xl text-sm">Cancel</button>
                <button onClick={addTable} disabled={!newTableNum} className="flex-1 py-2.5 bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-xl text-sm font-medium disabled:opacity-50">Add</button>
              </div>
            </div>
          </div>
        )}

        {/* Reserve table modal */}
        {showReserveTable && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-surface-border rounded-card shadow-card p-6 w-full max-w-sm space-y-4">
              <h2 className="text-xl font-bold">Reserve Table {showReserveTable.table_number}</h2>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Reservation Time</label>
                <input type="datetime-local" value={reservationTime} onChange={(e) => setReservationTime(e.target.value)} className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white outline-none focus:ring-2 focus:ring-accent-indigo" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowReserveTable(null); setReservationTime(''); }} className="flex-1 py-2.5 bg-transparent hover:bg-surface border border-surface-border text-text-secondary rounded-xl text-sm">Cancel</button>
                <button onClick={setReservation} disabled={!reservationTime} className="flex-1 py-2.5 bg-accent-indigo hover:bg-accent-indigo-hover text-white rounded-xl text-sm font-medium disabled:opacity-50">Save</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
