import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
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

    // 2. Check if user already exists (Re-activation flow)
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .single()

    let userId: string

    if (existingProfile) {
      // Re-activate existing user
      userId = existingProfile.id

      // Update profile
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({ role, is_active: true, is_logged_in: false })
        .eq('id', userId)

      if (updateProfileError) {
        console.error('Update profile error:', updateProfileError)
        return NextResponse.json({ error: 'Failed to reactivate user profile' }, { status: 500 })
      }

      // Update auth.users metadata
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        user_metadata: { role }
      })

      if (updateAuthError) {
        console.error('Update auth user error:', updateAuthError)
      }
    } else {
      // Create new user using Supabase Admin SDK (auto confirms email)
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

      userId = userData.user.id

      // Update the profile table explicitly
      await supabaseAdmin.from('profiles').update({ role }).eq('id', userId)
    }

    // 3. Mark the invite code as used
    await supabaseAdmin
      .from('invite_codes')
      .update({ status: 'used' })
      .eq('code', code.trim())

    // 4. Send welcome email
    try {
      const { error: emailError } = await resend.emails.send({
        from: 'TableFlow Staff System <noreply@tableflow.systems>',
        to: [email.trim().toLowerCase()],
        subject: 'Welcome to TableFlow!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #4F46E5;">Welcome to TableFlow!</h2>
            <p>Congratulations!</p>
            <p>Your staff account has been successfully created.</p>
            <p>You are now registered with the role of <strong>${role}</strong>.</p>
            <p>You can now log in using your email and the password you just created.</p>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This is an automated message from the TableFlow system.
            </p>
          </div>
        `,
      })
      if (emailError) {
        console.error('[welcome-email] Resend error:', emailError)
      }
    } catch (emailErr) {
      console.error('Failed to send welcome email:', emailErr)
      // Continue without blocking signup
    }

    return NextResponse.json({ success: true, userId })

  } catch (err) {
    console.error('Staff signup error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
