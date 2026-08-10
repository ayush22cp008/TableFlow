import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (code) {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Get user to check metadata and profile
      if (user) {
        const metadataRole = user.user_metadata?.role

        const isNewUser = (Date.now() - new Date(user.created_at).getTime()) < 10000
        if (isNewUser && !metadataRole) {
          return NextResponse.redirect(`${origin}/auth/select-role`)
        }

        // Check if there's any pending unused invite code for this email
        const { data: pendingInvites } = await supabase
          .from('invite_codes')
          .select('id')
          .eq('staff_email', user.email)
          .eq('status', 'unused')
          
        if (pendingInvites && pendingInvites.length > 0) {
          return NextResponse.redirect(`${origin}/auth/select-role`)
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
          
        if (profile?.role === 'owner') {
          return NextResponse.redirect(`${origin}/dashboard`)
        } else if (profile?.role === 'cook') {
          return NextResponse.redirect(`${origin}/dashboard/cook`)
        } else if (profile?.role === 'manager') {
          return NextResponse.redirect(`${origin}/dashboard/manager`)
        } else if (profile?.role === 'waiter') {
          return NextResponse.redirect(`${origin}/dashboard/waiter`)
        }
        return NextResponse.redirect(`${origin}/order`)
      }
    }
  }

  // Fallback if something goes wrong
  return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+magic+link`)
}
