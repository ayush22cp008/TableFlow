import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // 1. Verify caller is authenticated
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
        global: {
          fetch: (url, options) => {
            return fetch(url, { ...options, cache: 'no-store' })
          }
        }
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Verify caller is an owner
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden: Owners only' }, { status: 403 })
    }

    // 3. Deactivate the staff member and downgrade role to customer
    // Note: We previously applied a permanent ban here. This has been removed.

    // Note: the profiles.is_active flag should be set to false from the client
    // immediately prior to calling this API, or we could also do it here.
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active: false, is_logged_in: false, role: 'customer' })
      .eq('id', userId)

    if (updateError) {
      console.error('Profile update error:', updateError)
    }

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('Deactivate staff error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
