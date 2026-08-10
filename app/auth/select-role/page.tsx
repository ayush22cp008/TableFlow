'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { UserRole } from '@/types'
import { OWNER_INVITE_CODE } from '@/components/AuthForm'

const ROLE_ICONS: Record<UserRole, string> = {
  customer: '🍽️',
  owner: '👑',
  waiter: '🏃',
  cook: '👨‍🍳',
  manager: '📋'
}

export default function SelectRolePage() {
  const [role, setRole] = useState<UserRole>('customer')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const sentRolesRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [])

  useEffect(() => {
    if (userEmail && (role === 'waiter' || role === 'cook' || role === 'manager') && !sentRolesRef.current.has(role)) {
      sentRolesRef.current.add(role)
      fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, role })
      }).catch(console.error)
    }
  }, [role, userEmail])

  async function handleRoleStep(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    
    if (role === 'owner') {
      if (inviteCode.trim() !== OWNER_INVITE_CODE) {
        setError('Invalid owner invite code.')
        return
      }
    }

    setLoading(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || !user.email) {
      setError('No authenticated user found. Please try logging in again.')
      setLoading(false)
      return
    }

    if (role === 'waiter' || role === 'cook' || role === 'manager') {
      const res = await fetch('/api/auth/verify-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode, role })
      })
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Failed to verify invite code.')
        setLoading(false)
        return
      }

      window.location.href = role === 'manager' ? '/dashboard/manager' : role === 'cook' ? '/dashboard/cook' : role === 'waiter' ? '/dashboard/waiter' : '/order'
      return
    }

    // For owner and customer (non-staff roles), continue with client-side update
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // On success: redirect
    window.location.href = role === 'owner' ? '/dashboard' : '/order'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs for consistent styling if needed */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
      
      <div className="w-full max-w-md p-8 backdrop-blur-md bg-surface border border-surface-border rounded-card shadow-card relative z-10">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Create Account</h2>
          <p className="text-gray-400">Who are you joining as?</p>
        </div>

        <form onSubmit={handleRoleStep} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {(['customer', 'owner', 'waiter', 'cook', 'manager'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setInviteCode(''); setError(null); }}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  role === r
                    ? 'border-accent-indigo bg-accent-indigo/10 shadow-[0_0_15px_rgba(99,102,241,0.2)] text-white'
                    : 'border-surface-border bg-surface text-gray-400 hover:border-gray-600'
                }`}
              >
                <div className="text-2xl mb-1">{ROLE_ICONS[r]}</div>
                <div className="font-medium capitalize">{r}</div>
              </button>
            ))}
          </div>

          {(role === 'owner' || role === 'waiter' || role === 'cook' || role === 'manager') && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {role === 'owner' ? 'Owner Invite Code' : 'Staff Invite Code'}
              </label>
              <input
                id="invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-accent-indigo outline-none transition-all"
                placeholder="Enter invite code"
              />
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm">{error}</div>
          )}

          <button
            id="role-next"
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent-indigo hover:bg-accent-indigo-hover text-white font-medium rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
