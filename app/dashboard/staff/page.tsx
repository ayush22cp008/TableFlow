'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { InviteCode, UserProfile } from '@/types'
import Navbar from '@/components/Navbar'

// Extended profile type to include the joined staff_name and last_login
type StaffDetail = UserProfile & {
  staff_name?: string
  last_login?: string
  is_logged_in?: boolean
}

export default function StaffManagementPage() {
  const [codes, setCodes] = useState<InviteCode[]>([])
  const [staffList, setStaffList] = useState<StaffDetail[]>([])
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
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    
    // Fetch Invite Codes
    const { data: codesData, error: codesError } = await supabase
      .from('invite_codes')
      .select('*')
      .order('created_at', { ascending: false })

    if (codesError) {
      console.error(codesError)
      setError('Failed to load data.')
      setLoading(false)
      return
    }

    setCodes(codesData || [])

    // Fetch Active Staff Profiles
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, role, created_at, last_login, is_active, is_logged_in')
      .in('role', ['waiter', 'cook', 'manager'])
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (profilesError) {
      console.error(profilesError)
    } else {
      // Map profiles with invite_codes to get staff_name
      const mergedStaff = (profilesData || []).map(profile => {
        const matchingCode = codesData?.find(
          c => c.status === 'used' && c.staff_email.toLowerCase() === profile.email.toLowerCase()
        )
        return {
          ...profile,
          staff_name: matchingCode ? matchingCode.staff_name : profile.email.split('@')[0]
        }
      })
      setStaffList(mergedStaff)
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
      fetchData()
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
      .eq('status', 'unused')

    if (updateError) {
      alert(updateError.message)
    } else {
      setEditingId(null)
      fetchData()
    }
  }

  async function handleForceLogout() {
    if (!confirm("Are you sure? This will instantly log out all currently active staff members from their devices.")) {
      return
    }
    const { error } = await supabase.rpc('force_logout_all_staff')
    if (error) {
      alert(`Error forcing logout: ${error.message}`)
    } else {
      alert("All staff have been successfully logged out.")
    }
  }

  async function handleDeactivate(userId: string, staffName: string) {
    if (!confirm(`Are you sure you want to deactivate ${staffName}? They will no longer be able to log in.`)) {
      return
    }

    // Call API to ban user
    const res = await fetch('/api/staff/deactivate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    })

    const data = await res.json()
    if (!res.ok) {
      alert(data.error || 'Failed to deactivate staff')
      return
    }

    // Refresh list locally
    setStaffList(prev => prev.filter(s => s.id !== userId))
    alert(`${staffName} has been deactivated.`)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="p-8 max-w-6xl mx-auto space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Staff Management</h1>
            <p className="text-gray-400">Manage active staff members and generate invite codes.</p>
          </div>
          <button 
            onClick={handleForceLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            End Day — Log Out All Staff
          </button>
        </div>

        {/* 1. Staff Details Section */}
        <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-card">
          <div className="p-4 border-b border-surface-border bg-gray-800/20">
            <h2 className="text-lg font-semibold text-white">Active Staff</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-800/40 text-gray-400 text-sm">
                  <th className="p-4 font-medium">Name</th>
                  <th className="p-4 font-medium">Email</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Join Date</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {loading ? (
                  <tr><td colSpan={6} className="p-4 text-center text-gray-400">Loading staff...</td></tr>
                ) : staffList.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center text-gray-400">No active staff members found.</td></tr>
                ) : (
                  staffList.map(staff => {
                    const isActive = staff.is_logged_in

                    return (
                      <tr key={staff.id} className="text-sm hover:bg-gray-800/30 transition-colors">
                        <td className="p-4 font-medium text-white">{staff.staff_name}</td>
                        <td className="p-4 text-gray-300">{staff.email}</td>
                        <td className="p-4 capitalize text-gray-300">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-700/50 border border-gray-600">
                            {staff.role}
                          </span>
                        </td>
                        <td className="p-4 text-gray-400">
                          {new Date(staff.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleDeactivate(staff.id, staff.staff_name || staff.email)}
                            className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Invite Code Generator */}
        <div className="bg-surface border border-surface-border rounded-xl p-6 shadow-card">
          <h2 className="text-xl font-semibold text-white mb-4">Generate Invite Code</h2>
          <form onSubmit={handleGenerate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'waiter' | 'cook' | 'manager')}
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white outline-none focus:border-indigo-500 transition-colors"
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
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white outline-none focus:border-indigo-500 transition-colors"
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
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white outline-none focus:border-indigo-500 transition-colors"
                placeholder="john@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={generating}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {generating ? 'Generating...' : 'Generate Code'}
            </button>
          </form>
          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
          {successMsg && <p className="text-green-400 text-sm mt-4">{successMsg}</p>}
        </div>

        {/* 3. Invite Codes History */}
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
                      <td className="p-4 font-mono font-medium text-indigo-400">{c.code}</td>
                      <td className="p-4 capitalize text-gray-300">{c.role}</td>
                      <td className="p-4 text-white">
                        {editingId === c.id ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-full text-white outline-none focus:border-indigo-500"
                          />
                        ) : c.staff_name}
                      </td>
                      <td className="p-4 text-gray-300">
                        {editingId === c.id ? (
                          <input
                            type="email"
                            value={editEmail}
                            onChange={e => setEditEmail(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded px-2 py-1 w-full text-white outline-none focus:border-indigo-500"
                          />
                        ) : c.staff_email}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${
                          c.status === 'unused' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                          c.status === 'used' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                          'bg-red-500/10 text-red-400 border-red-500/20'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {c.status === 'unused' && (
                          editingId === c.id ? (
                            <div className="flex gap-3">
                              <button onClick={() => handleSaveEdit(c.id)} className="text-green-400 hover:text-green-300 font-medium transition-colors">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-300 transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(c.id);
                                setEditName(c.staff_name);
                                setEditEmail(c.staff_email);
                              }}
                              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
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
    </div>
  )
}
