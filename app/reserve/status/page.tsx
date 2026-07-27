'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import { ReservationRequest } from '@/types'
import { PageLoader } from '@/components/LoadingSpinner'

export default function ReserveStatusPage() {
  const [name, setName] = useState('')
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [requests, setRequests] = useState<ReservationRequest[]>([])

  async function searchRequests(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return
    setLoading(true)
    
    const { data } = await supabase
      .from('reservation_requests')
      .select('*')
      .ilike('customer_name', `%${name}%`)
      .order('created_at', { ascending: false })

    setRequests(data as ReservationRequest[] || [])
    setSearched(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">Check Reservation Status</h1>
        
        <form onSubmit={searchRequests} className="flex gap-2 mb-8">
          <input 
            type="text" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="Enter your name..." 
            className="flex-1 px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button type="submit" disabled={!name || loading} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50">
            Search
          </button>
        </form>

        {loading && <PageLoader />}

        {!loading && searched && (
          <div className="space-y-4">
            {requests.map(req => (
              <div key={req.id} className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold">{req.customer_name}</h3>
                    <p className="text-sm text-gray-400">Party of {req.party_size} • {new Date(req.requested_time).toLocaleString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                    req.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                    req.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                    req.status === 'arrived' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {req.status}
                  </span>
                </div>
                {req.status === 'approved' && req.unique_code && (
                  <div className="mt-4 p-3 bg-indigo-900/30 border border-indigo-500/30 rounded-lg text-center">
                    <p className="text-sm text-indigo-300 mb-1">Your Entry Code</p>
                    <p className="text-2xl font-mono font-bold tracking-widest text-indigo-400">{req.unique_code}</p>
                  </div>
                )}
              </div>
            ))}
            {requests.length === 0 && <p className="text-gray-400 text-center py-8">No requests found for that name.</p>}
          </div>
        )}
      </main>
    </div>
  )
}
