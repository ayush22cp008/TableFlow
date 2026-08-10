import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

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

    // 2.5. Send deactivation email
    try {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (!userError && userData?.user?.email) {
        const staffEmail = userData.user.email
        await resend.emails.send({
          from: 'TableFlow Staff System <noreply@tableflow.systems>',
          to: [staffEmail],
          subject: 'Your TableFlow staff access has been removed',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #4F46E5;">TableFlow Access Removed</h2>
              <p>Hello,</p>
              <p>Your staff access for TableFlow has been removed.</p>
              <p>If you believe this is a mistake or if this is unexpected, please contact your restaurant owner or manager.</p>
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                This is an automated message from the TableFlow system.
              </p>
            </div>
          `,
        })
      }
    } catch (emailErr) {
      console.error('Failed to send deactivation email:', emailErr)
      // Continue without blocking deactivation
    }

    // 3. Fully delete the staff member (Hard Delete)
    // First, delete the public.profiles row to avoid foreign key constraints
    // (in case ON DELETE CASCADE is not set up on the auth.users reference)
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileDeleteError) {
      console.error('Profile delete error:', profileDeleteError)
      return NextResponse.json({ error: 'Failed to delete user profile' }, { status: 500 })
    }

    // 4. Delete the user from Supabase Auth
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (authDeleteError) {
      console.error('Auth user delete error:', authDeleteError)
      return NextResponse.json({ error: 'Failed to delete auth user' }, { status: 500 })
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
