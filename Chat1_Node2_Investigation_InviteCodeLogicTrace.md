# TableFlow — Chat 1 / Node 2 — Investigation Report

## 1. Role-Choice Screen
**File:** [`components/AuthForm.tsx`](file:///c:/Users/ayush/Desktop/vibethon_project/components/AuthForm.tsx)
**Snippet:**
```tsx
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
// ...
```

## 2. Owner Selection UI
When "Owner" is selected, it prompts for an invite code directly in the form.
**File:** [`components/AuthForm.tsx`](file:///c:/Users/ayush/Desktop/vibethon_project/components/AuthForm.tsx)
**Snippet:**
```tsx
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
```

## 3. Invite-Code Validation Logic
The logic is embedded directly inside the `AuthForm` component's state and transition handler (`handleRoleStep`), relying on a module-level constant.
**File:** [`components/AuthForm.tsx`](file:///c:/Users/ayush/Desktop/vibethon_project/components/AuthForm.tsx)
**Snippet:**
```tsx
const OWNER_INVITE_CODE = 'TableFlow12'
// ...
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
```

## 4. Setting Role and Redirecting
A valid invite code allows the user to proceed to the `credentials` step. The `role` state is passed in `user_metadata` upon signup. After OTP verification, they are redirected to `/dashboard`.
**File:** [`components/AuthForm.tsx`](file:///c:/Users/ayush/Desktop/vibethon_project/components/AuthForm.tsx)
**Snippet:**
```tsx
    // Sign up with email+password — Supabase sends OTP email
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Store role in user_metadata — we also update profiles table after OTP verify
        data: { role },
      },
    })
```
And the redirect logic after successful verification:
```tsx
      const userRole = profile?.role || metadataRole || 'customer'
      window.location.href = userRole === 'owner' ? '/dashboard' : '/order'
```

## 5. Handling Invalid/Missing Invite Code
An invalid or missing invite code blocks the signup flow at the role step by preventing the transition to the next state (`credentials`) and displaying an error message in the UI.
**File:** [`components/AuthForm.tsx`](file:///c:/Users/ayush/Desktop/vibethon_project/components/AuthForm.tsx)
**Snippet:**
```tsx
    if (role === 'owner') {
      if (inviteCode.trim() !== OWNER_INVITE_CODE) {
        setError('Invalid owner invite code.')
        return
      }
    }
```

## Decision Gate
**NOT CLEANLY REUSABLE** — invite-code validation is embedded in the manual signup component and reusing it would require refactoring manual-flow code.
