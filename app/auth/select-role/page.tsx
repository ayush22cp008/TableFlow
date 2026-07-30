'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserRole } from '@/types'
import { OWNER_INVITE_CODE } from '@/components/AuthForm'

export default function SelectRolePage() {
  const [role, setRole] = useState<UserRole>('customer')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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
    
    if (!user) {
      setError('No authenticated user found. Please try logging in again.')
      setLoading(false)
      return
    }

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
            {(['customer', 'owner'] as UserRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`p-4 rounded-xl border-2 text-center transition-all ${
                  role === r
                    ? 'border-accent-indigo bg-accent-indigo/10 shadow-[0_0_15px_rgba(99,102,241,0.2)] text-white'
                    : 'border-surface-border bg-surface text-gray-400 hover:border-gray-600'
                }`}
              >
                <div className="text-2xl mb-1">{r === 'customer' ? '🍽️' : '👨‍🍳'}</div>
                <div className="font-medium capitalize">{r}</div>
              </button>
            ))}
          </div>

          {role === 'owner' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Owner Invite Code</label>
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
