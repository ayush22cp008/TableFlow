import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { email, role } = await request.json()

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      )
    }

    // Lookup matching unused invite code for this email and role
    const { data: codeData, error: dbError } = await supabaseAdmin
      .from('invite_codes')
      .select('*')
      .eq('staff_email', email)
      .eq('role', role)
      .eq('status', 'unused')
      .single()

    if (dbError || !codeData) {
      return NextResponse.json(
        { error: 'No valid invite code found for this email and role.' },
        { status: 404 }
      )
    }

    // Send the email via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'TableFlow Staff System <noreply@tableflow.systems>',
      to: [email],
      subject: 'Your TableFlow Staff Invite Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #4F46E5;">Welcome to TableFlow!</h2>
          <p>You have been invited to join the staff as a <strong>${role}</strong>.</p>
          <p>Your invite code is:</p>
          <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 2px; font-weight: bold; border-radius: 4px; margin: 20px 0;">
            ${codeData.code}
          </div>
          <p>Return to the signup page and enter this code along with your desired password to complete your account setup.</p>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      return NextResponse.json(
        { error: 'Failed to send invite email. Please try again later.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Send invite error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
