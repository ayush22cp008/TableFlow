'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { useAuth } from '@/lib/AuthContext'
import { PageLoader } from '@/components/LoadingSpinner'

export default function OrderReservationPage() {
  const { user, loading: authLoading } = useAuth()
  
  const [name, setName] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [requestedTime, setRequestedTime] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activeReservation, setActiveReservation] = useState<any | null>(null)

  useEffect(() => {
    async function checkReservation() {
      if (authLoading) return
      if (!user) {
        setLoading(false)
        return
      }

      // Auto-fill name if profile email exists (optional enhancement from instruction)
      const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).single()
      if (profile?.email) {
        setName(profile.email.split('@')[0])
      }

      // Fetch most recent reservation for this user
      const { data } = await supabase
        .from('reservation_requests')
        .select('*, restaurant_tables(table_number)')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data && ['pending', 'approved', 'arrived'].includes(data.status)) {
        setActiveReservation(data)
      }
      
      setLoading(false)
    }
    
    checkReservation()
    
    if (!user) return
    const channel = supabase.channel('reservation_status_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_requests', filter: `customer_id=eq.${user.id}` }, checkReservation)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, authLoading])

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    
    setSubmitting(true)
    setError(null)
    
    const { data, error: err } = await supabase.from('reservation_requests').insert({
      customer_name: name,
      customer_id: user.id, // Capture customer_id
      party_size: parseInt(partySize) || 2,
      requested_time: new Date(requestedTime).toISOString(),
    }).select('*, restaurant_tables(table_number)').single()

    if (err) {
      setError(err.message)
      setSubmitting(false)
      return
    }

    setActiveReservation(data)
    setSubmitting(false)
  }

  if (authLoading || loading) return <PageLoader />

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navbar />
        <main className="max-w-md mx-auto px-4 py-20 text-center">
          <p className="text-gray-400">Please sign in to make a reservation.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-md mx-auto px-4 py-10">
        
        {activeReservation ? (
          <div>
            <h1 className="text-2xl font-bold mb-6">Your Reservation</h1>
            <div className="p-6 bg-surface border border-surface-border rounded-card shadow-card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg text-white">{activeReservation.customer_name}</h3>
                  <p className="text-sm text-gray-400 mt-1">
                    Party of {activeReservation.party_size} • {new Date(activeReservation.requested_time).toLocaleString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                  activeReservation.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                  activeReservation.status === 'arrived' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {activeReservation.status}
                </span>
              </div>
              
              {activeReservation.restaurant_tables?.table_number && (
                <div className="mb-4 text-sm text-gray-300">
                  Assigned Table: <span className="font-bold text-white">{activeReservation.restaurant_tables.table_number}</span>
                </div>
              )}

              {activeReservation.status === 'approved' && activeReservation.unique_code && (
                <div className="mt-4 p-4 bg-indigo-900/30 border border-indigo-500/30 rounded-lg text-center">
                  <p className="text-sm text-indigo-300 mb-2">Your Entry Code</p>
                  <p className="text-3xl font-mono font-bold tracking-widest text-accent-amber">{activeReservation.unique_code}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold mb-6">Request a Table</h1>
            <form onSubmit={submitRequest} className="space-y-4 bg-surface border border-surface-border p-6 rounded-card shadow-card">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
                <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-accent-indigo" placeholder="John Doe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Party Size</label>
                <input required type="number" min={1} value={partySize} onChange={(e) => setPartySize(e.target.value)} className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-accent-indigo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Requested Time</label>
                <input required type="datetime-local" value={requestedTime} onChange={(e) => setRequestedTime(e.target.value)} className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-accent-indigo" />
              </div>
              {error && <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">{error}</div>}
              <button type="submit" disabled={submitting || !name || !requestedTime} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50 transition-all mt-4">
                {submitting ? 'Submitting...' : 'Send Request'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  )
}
