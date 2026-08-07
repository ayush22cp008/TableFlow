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

        // Ensure profiles table has the correct role (crucial for owners)
        if (metadataRole) {
          await supabase.from('profiles').update({ role: metadataRole }).eq('id', user.id)
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
          
        if (profile?.role === 'owner' || metadataRole === 'owner') {
          return NextResponse.redirect(`${origin}/dashboard`)
        } else if (profile?.role === 'cook' || metadataRole === 'cook') {
          return NextResponse.redirect(`${origin}/dashboard/cook`)
        } else if (profile?.role === 'manager' || metadataRole === 'manager') {
          return NextResponse.redirect(`${origin}/dashboard/manager`)
        }
        return NextResponse.redirect(`${origin}/order`)
      }
    }
  }

  // Fallback if something goes wrong
  return NextResponse.redirect(`${origin}/login?error=Invalid+or+expired+magic+link`)
}
