import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { code, role } = await request.json()

    if (!code || !role) {
      return NextResponse.json(
        { error: 'Code and role are required' },
        { status: 400 }
      )
    }

    // 1. Get current authenticated user securely
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // The setAll method was called from a Server Component.
              // This can be ignored if you have middleware refreshing user sessions.
            }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Unauthorized or missing email' },
        { status: 401 }
      )
    }

    // 2. Validate the invite code with Admin SDK (bypassing RLS)
    const { data: codeData, error: dbError } = await supabaseAdmin
      .from('invite_codes')
      .select('*')
      .eq('code', code.trim())
      .single()

    if (dbError || !codeData || codeData.status !== 'unused') {
      return NextResponse.json(
        { error: 'Invalid, unused, or expired invite code.' },
        { status: 400 }
      )
    }

    if (codeData.staff_email.toLowerCase() !== user.email.trim().toLowerCase()) {
      return NextResponse.json(
        { error: 'This invite code is registered to a different email address.' },
        { status: 400 }
      )
    }

    if (codeData.role !== role) {
      return NextResponse.json(
        { error: 'This invite code is not for the selected role.' },
        { status: 400 }
      )
    }

    // 3. Update the user's role in the profiles table
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({ role })
      .eq('id', user.id)

    if (updateProfileError) {
      console.error('Update profile error:', updateProfileError)
      return NextResponse.json(
        { error: 'Failed to assign role to profile.' },
        { status: 500 }
      )
    }

    // 4. Mark the invite code as used
    const { error: updateCodeError } = await supabaseAdmin
      .from('invite_codes')
      .update({ status: 'used' })
      .eq('code', code.trim())
      
    if (updateCodeError) {
      console.error('Update code error:', updateCodeError)
      // Profile updated but code not marked used (acceptable edge case)
    }

    return NextResponse.json({ success: true, role })

  } catch (err) {
    console.error('Verify invite error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
