import { NextResponse } from 'next/server'
import webpush from '@/lib/web-push'
import { createClient } from '@supabase/supabase-js'

const WEBHOOK_SECRET = process.env.PUSH_WEBHOOK_SECRET || 'secret'

export async function POST(req: Request) {
  try {
    // Basic auth check
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await req.json()

    // We only care about inserts
    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      return NextResponse.json({ success: true, ignored: true })
    }

    const notification = payload.record
    if (!notification) {
      return NextResponse.json({ error: 'No record found' }, { status: 400 })
    }

    // Use service role key to bypass RLS and read subscriptions
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Resolve recipients
    let userIds: string[] = []
    if (notification.recipient_id) {
      userIds.push(notification.recipient_id)
    } else if (notification.recipient_role) {
      // Find all active users with this role
      const { data: roleUsers, error: roleError } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', notification.recipient_role)
        .eq('is_active', true)
      
      if (!roleError && roleUsers) {
        userIds = roleUsers.map(u => u.id)
      }
    }

    if (userIds.length === 0) {
      return NextResponse.json({ success: true, delivered: 0 })
    }

    // Fetch active subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds)
      .eq('is_active', true)

    if (subError || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, delivered: 0 })
    }

    // Deliver push
    const notificationPayload = JSON.stringify({
      title: 'TableFlow',
      body: notification.message,
      url: `/dashboard/${notification.recipient_role || 'manager'}` // Base logic, can be customized
    })

    let delivered = 0
    for (const sub of subscriptions) {
      // Deduplication check: race-safe insert
      const { error: dedupError } = await supabase
        .from('push_delivery_dedup')
        .insert({
          notification_id: notification.id,
          subscription_id: sub.id
        })
      
      // If insert fails (likely unique constraint violation), skip sending
      if (dedupError) {
        console.log(`Skipping duplicate push for notification ${notification.id} to subscription ${sub.id}`)
        continue
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth
            }
          },
          notificationPayload
        )
        delivered++
        // Mark dedup as successfully processed
        await supabase
          .from('push_delivery_dedup')
          .update({ success_at: new Date().toISOString() })
          .eq('notification_id', notification.id)
          .eq('subscription_id', sub.id)

        // Update last_success_at
        await supabase
          .from('push_subscriptions')
          .update({ last_success_at: new Date().toISOString() })
          .eq('id', sub.id)
      } catch (err) {
        const error = err as { statusCode?: number };
        console.error('Push delivery failed for subscription ID:', sub.id, error.statusCode)
        if (error.statusCode === 404 || error.statusCode === 410) {
          // Subscription invalid
          await supabase
            .from('push_subscriptions')
            .update({ 
              is_active: false, 
              last_failure_at: new Date().toISOString(),
              failure_reason: 'HTTP ' + error.statusCode
            })
            .eq('id', sub.id)
        }
      }
    }

    return NextResponse.json({ success: true, delivered })
  } catch (err) {
    console.error('Webhook delivery error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}







