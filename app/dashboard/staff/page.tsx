'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { InviteCode } from '@/types'

export default function StaffManagementPage() {
  const [codes, setCodes] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'waiter' | 'cook' | 'manager'>('waiter')
  const [generating, setGenerating] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')

  useEffect(() => {
    fetchCodes()
  }, [])

  async function fetchCodes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      setError('Failed to load invite codes.')
    } else {
      setCodes(data || [])
    }
    setLoading(false)
  }

  function generateRandomCode(role: 'waiter' | 'cook' | 'manager') {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let randomPart = ''
    for (let i = 0; i < 5; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    const tag = role === 'waiter' ? 'WT' : role === 'cook' ? 'CO' : 'MN'
    // Insert tag at a random position (0 to 5)
    const pos = Math.floor(Math.random() * 6)
    return randomPart.slice(0, pos) + tag + randomPart.slice(pos)
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    setGenerating(true)
    setError(null)
    setSuccessMsg(null)

    const code = generateRandomCode(role)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      setError('You must be logged in to generate a code.')
      setGenerating(false)
      return
    }

    const { error: insertError } = await supabase.from('invite_codes').insert({
      code,
      role,
      staff_name: name,
      staff_email: email.trim().toLowerCase(),
      created_by: user.id
    })

    if (insertError) {
      setError(insertError.message)
    } else {
      setSuccessMsg(`Generated code: ${code}`)
      setName('')
      setEmail('')
      fetchCodes()
    }
    setGenerating(false)
  }

  async function handleSaveEdit(id: string) {
    const { error: updateError } = await supabase
      .from('invite_codes')
      .update({
        staff_name: editName,
        staff_email: editEmail.trim().toLowerCase()
      })
      .eq('id', id)
      .eq('status', 'unused') // can only edit unused

    if (updateError) {
      alert(updateError.message)
    } else {
      setEditingId(null)
      fetchCodes()
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Staff Management</h1>
        <p className="text-gray-400">Generate and manage invite codes for your staff.</p>
      </div>

      <div className="bg-surface border border-surface-border rounded-xl p-6 shadow-card">
        <h2 className="text-xl font-semibold text-white mb-4">Generate Invite Code</h2>
        <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'waiter' | 'cook' | 'manager')}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white outline-none"
            >
              <option value="waiter">Waiter</option>
              <option value="cook">Cook</option>
              <option value="manager">Manager</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Staff Name</label>
            <input
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white outline-none"
              placeholder="e.g. John Doe"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Staff Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white outline-none"
              placeholder="john@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={generating}
            className="w-full py-2 bg-accent-indigo hover:bg-accent-indigo-hover text-white font-medium rounded-lg disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Code'}
          </button>
        </form>
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        {successMsg && <p className="text-green-400 text-sm mt-4">{successMsg}</p>}
      </div>

      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-card">
        <div className="p-4 border-b border-surface-border bg-gray-800/20">
          <h2 className="text-lg font-semibold text-white">Invite Codes History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-800/40 text-gray-400 text-sm">
                <th className="p-4 font-medium">Code</th>
                <th className="p-4 font-medium">Role</th>
                <th className="p-4 font-medium">Name</th>
                <th className="p-4 font-medium">Email</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-400">Loading codes...</td></tr>
              ) : codes.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-400">No invite codes generated yet.</td></tr>
              ) : (
                codes.map(c => (
                  <tr key={c.id} className="text-sm">
                    <td className="p-4 font-mono font-medium text-accent-indigo">{c.code}</td>
                    <td className="p-4 capitalize text-gray-300">{c.role}</td>
                    <td className="p-4 text-white">
                      {editingId === c.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-full text-white"
                        />
                      ) : c.staff_name}
                    </td>
                    <td className="p-4 text-gray-300">
                      {editingId === c.id ? (
                        <input
                          type="email"
                          value={editEmail}
                          onChange={e => setEditEmail(e.target.value)}
                          className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-full text-white"
                        />
                      ) : c.staff_email}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        c.status === 'unused' ? 'bg-green-500/20 text-green-400' :
                        c.status === 'used' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {c.status === 'unused' && (
                        editingId === c.id ? (
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveEdit(c.id)} className="text-green-400 hover:text-green-300">Save</button>
                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-300">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingId(c.id);
                              setEditName(c.staff_name);
                              setEditEmail(c.staff_email);
                            }}
                            className="text-accent-indigo hover:text-accent-indigo-hover"
                          >
                            Edit
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
