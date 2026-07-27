'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default function ReservePage() {
  const [name, setName] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [requestedTime, setRequestedTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function submitRequest(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    const { error: err } = await supabase.from('reservation_requests').insert({
      customer_name: name,
      party_size: parseInt(partySize) || 2,
      requested_time: new Date(requestedTime).toISOString(),
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <Navbar />
        <main className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold mb-2">Request Sent!</h1>
          <p className="text-gray-400 mb-8">Waiting for owner approval.</p>
          <Link href="/reserve/status" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all">
            Check Status
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Navbar />
      <main className="max-w-md mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">Request a Table</h1>
        <form onSubmit={submitRequest} className="space-y-4 bg-gray-900/50 border border-gray-800 p-6 rounded-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input required type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="John Doe" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Party Size</label>
            <input required type="number" min={1} value={partySize} onChange={(e) => setPartySize(e.target.value)} className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Requested Time</label>
            <input required type="datetime-local" value={requestedTime} onChange={(e) => setRequestedTime(e.target.value)} className="w-full px-4 py-2.5 bg-gray-800/50 border border-gray-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {error && <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">{error}</div>}
          <button type="submit" disabled={loading || !name || !requestedTime} className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium disabled:opacity-50 transition-all mt-4">
            {loading ? 'Submitting...' : 'Send Request'}
          </button>
        </form>
      </main>
    </div>
  )
}
