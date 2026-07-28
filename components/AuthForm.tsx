'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
// import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserRole } from '@/types'

// ============================================================
// Owner invite code gate — client-side UX gate only.
// Real security is via RLS is_owner() check in DB.
// Change this value before demoing if needed.
// ============================================================
const OWNER_INVITE_CODE = 'VIBETHON2025'

type SignupStep = 'role' | 'credentials' | 'verify'

export function AuthForm({ view }: { view: 'login' | 'signup' }) {
  // const router = useRouter()

  // --- Signup state ---
  const [step, setStep] = useState<SignupStep>('role')
  const [role, setRole] = useState<UserRole>('customer')
  const [inviteCode, setInviteCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [otpCode, setOtpCode] = useState('')

  // ---- SIGNUP FLOW ----

  async function handleRoleStep(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (role === 'owner') {
      if (inviteCode.trim() !== OWNER_INVITE_CODE) {
        setError('Invalid owner invite code.')
        return
      }
    }
    setStep('credentials')
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // IMPORTANT NOTE FOR DEV/TESTING (Resend Free Tier):
    // Since we are using Resend's sandbox mode (no custom domain verified yet),
    // emails will ONLY be delivered to the email address that the Resend account
    // was created with. Any other email addresses will silently fail to deliver.
    
    // Sign up with email+password — Supabase sends OTP email
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Store role in user_metadata — we also update profiles table after OTP verify
        data: { role },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    setStep('verify')
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'signup'
    })

    if (verifyError) {
      setError(verifyError.message)
      setLoading(false)
      return
    }

    // On success: fetch the user, update the profiles table, redirect
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const metadataRole = user.user_metadata?.role

      if (metadataRole) {
        await supabase.from('profiles').update({ role: metadataRole }).eq('id', user.id)
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
        
      const userRole = profile?.role || metadataRole || 'customer'
      window.location.href = userRole === 'owner' ? '/dashboard' : '/order'
    } else {
      setError('Verification succeeded but failed to retrieve user.')
      setLoading(false)
    }
  }

  // ---- LOGIN FLOW ----

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: loginError, data: loginData } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (loginError) {
      setError(loginError.message)
      setLoading(false)
      return
    }

    // Explicitly fetch role and redirect to prevent getting stuck
    if (loginData?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', loginData.user.id)
        .single()
      
      const userRole = profile?.role || 'customer'
      window.location.href = userRole === 'owner' ? '/dashboard' : '/order'
    }
  }

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  // ---- RENDER ----

  if (view === 'login') {
    return (
      <div className="w-full max-w-md p-8 backdrop-blur-md bg-gray-900/40 border border-gray-800 rounded-2xl shadow-xl relative z-10">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-gray-400">Sign in to your account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm">{error}</div>
          )}

          <button
            id="login-submit"
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 shadow-[0_0_15px_rgba(79,70,229,0.3)]"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4">
          <div className="relative flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-700" />
            <span className="text-xs text-gray-500">or</span>
            <div className="flex-1 h-px bg-gray-700" />
          </div>
          <button
            id="google-login"
            onClick={handleGoogleLogin}
            className="w-full py-3 flex items-center justify-center gap-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 text-white font-medium rounded-xl transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-400">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign up</Link>
        </p>
      </div>
    )
  }

  // ---- SIGNUP ----

  // Step 1: Choose role
  if (step === 'role') {
    return (
      <div className="w-full max-w-md p-8 backdrop-blur-md bg-gray-900/40 border border-gray-800 rounded-2xl shadow-xl relative z-10">
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
                    ? 'border-indigo-500 bg-indigo-500/10 text-white'
                    : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
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
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
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
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all transform hover:scale-[1.02]"
          >
            Continue
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">Sign in</Link>
        </p>
      </div>
    )
  }

  // Step 2: Email + Password
  if (step === 'credentials') {
    return (
      <div className="w-full max-w-md p-8 backdrop-blur-md bg-gray-900/40 border border-gray-800 rounded-2xl shadow-xl relative z-10">
        <button onClick={() => setStep('role')} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1">
          ← Back
        </button>
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Your Details</h2>
          <p className="text-gray-400">Signing up as <span className="text-indigo-400 capitalize">{role}</span></p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="Min. 6 characters"
              minLength={6}
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm">{error}</div>
          )}

          <button
            id="signup-submit"
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50"
          >
            {loading ? 'Sending OTP...' : 'Continue'}
          </button>
        </form>
      </div>
    )
  }

  // Step 3: Verify (OTP sent)
  return (
    <div className="w-full max-w-md p-8 backdrop-blur-md bg-gray-900/40 border border-gray-800 rounded-2xl shadow-xl relative z-10">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Enter Verification Code</h2>
        <p className="text-gray-400">
          We sent a 6-digit code to <span className="text-indigo-400 font-medium">{email}</span>.
        </p>
      </div>

      <form onSubmit={handleVerifyOtp} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Verification Code</label>
          <input
            id="otp-code"
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-center tracking-widest text-2xl font-mono"
            placeholder="000000"
            required
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/50 text-red-400 text-sm">{error}</div>
        )}

        <button
          id="verify-submit"
          type="submit"
          disabled={loading || otpCode.length < 6}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 shadow-[0_0_15px_rgba(79,70,229,0.3)]"
        >
          {loading ? 'Verifying...' : 'Verify & Sign In'}
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-800 text-center">
        <p className="text-xs text-gray-500">
          Didn&apos;t receive it? Check your spam folder, or{' '}
          <button onClick={() => setStep('credentials')} className="text-indigo-400 hover:text-indigo-300 transition-colors">
            try another email
          </button>.
        </p>
      </div>
    </div>
  )
}
