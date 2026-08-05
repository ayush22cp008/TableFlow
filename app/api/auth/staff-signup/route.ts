import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function POST(request: Request) {
  try {
    const { email, role, code, password } = await request.json()

    if (!email || !role || !code || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // 1. Validate the invite code in the DB (layer 3 validation)
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

    if (codeData.staff_email.toLowerCase() !== email.trim().toLowerCase()) {
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

    // 2. Create the user using Supabase Admin SDK (auto confirms email)
    const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role }
    })

    if (createUserError) {
      console.error('Create user error:', createUserError)
      return NextResponse.json(
        { error: createUserError.message },
        { status: 500 }
      )
    }

    // Wait, the profiles table needs to be updated. Since there's a trigger for profile creation,
    // we should just update the role in the profiles table, or maybe the trigger handles user_metadata.
    // Let's explicitly update the profile table to be safe, just like the client flow does.
    if (userData?.user?.id) {
      await supabaseAdmin.from('profiles').update({ role }).eq('id', userData.user.id)
    }

    // 3. Mark the invite code as used
    await supabaseAdmin
      .from('invite_codes')
      .update({ status: 'used' })
      .eq('code', code.trim())

    return NextResponse.json({ success: true, user: userData.user })

  } catch (err) {
    console.error('Staff signup error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
