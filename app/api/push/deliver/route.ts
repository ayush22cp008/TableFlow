import { NextResponse } from 'next/server'
import webpush from '@/lib/web-push'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const WEBHOOK_SECRET = process.env.PUSH_WEBHOOK_SECRET
    if (!WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'PUSH_WEBHOOK_SECRET is not configured' }, { status: 500 })
    }

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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase credentials missing' }, { status: 500 })
    }
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
      
      if (roleError) {
        throw new Error('Failed to resolve recipient role: ' + roleError.message)
      }
      if (roleUsers) {
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

    if (subError) {
       throw new Error('Failed to fetch subscriptions: ' + subError.message)
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, delivered: 0 })
    }

    // Deliver push
    const notificationPayload = JSON.stringify({
      title: 'TableFlow',
      body: notification.message,
      url: `/dashboard/${notification.recipient_role || 'manager'}`
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
      
      if (dedupError) {
        if (dedupError.code === '23505') {
          // Unique violation. It might be a successful duplicate or crashed in-progress.
          const { data: existing, error: fetchError } = await supabase
            .from('push_delivery_dedup')
            .select('success_at, created_at')
            .eq('notification_id', notification.id)
            .eq('subscription_id', sub.id)
            .single()

          if (fetchError || !existing) {
            throw new Error('Failed to fetch existing dedup row: ' + fetchError?.message)
          }

          if (existing.success_at !== null) {
             console.log(`Skipping successfully processed duplicate push for notification ${notification.id} to subscription ${sub.id}`)
             continue
          } else {
             // Incomplete/in-progress attempt
             const ageMs = Date.now() - new Date(existing.created_at).getTime()
             if (ageMs < 60000) {
                console.log(`Skipping actively processing push attempt for sub ${sub.id}`)
                continue
             }
             
             // Takeover via OCC delete
             const { data: deleted, error: deleteError } = await supabase
               .from('push_delivery_dedup')
               .delete()
               .eq('notification_id', notification.id)
               .eq('subscription_id', sub.id)
               .is('success_at', null)
               .eq('created_at', existing.created_at)
               .select()
               .maybeSingle()
             
             if (deleteError || !deleted) {
               continue // Someone else took it over
             }
             
             // Re-insert
             const { error: reInsertError } = await supabase
               .from('push_delivery_dedup')
               .insert({ notification_id: notification.id, subscription_id: sub.id })
               
             if (reInsertError) {
               if (reInsertError.code === '23505') {
                 continue
               }
               throw new Error('Database error during dedup takeover: ' + reInsertError.message)
             }
          }
        } else {
          // Real database error, fail the webhook so it retries
          throw new Error('Database error during deduplication: ' + dedupError.message)
        }
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
      } catch (err: unknown) {
        const error = err as { statusCode?: number };
        const statusCode = error.statusCode;
        console.error('Push delivery failed for subscription ID:', sub.id, statusCode)
        
        // Remove the dedup lock so a future retry can attempt delivery again
        await supabase
          .from('push_delivery_dedup')
          .delete()
          .eq('notification_id', notification.id)
          .eq('subscription_id', sub.id)

        if (statusCode === 404 || statusCode === 410) {
          // Subscription permanently invalid
          await supabase
            .from('push_subscriptions')
            .update({ 
              is_active: false, 
              last_failure_at: new Date().toISOString(),
              failure_reason: 'HTTP ' + statusCode
            })
            .eq('id', sub.id)
        }
      }
    }

    return NextResponse.json({ success: true, delivered })
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Webhook delivery error:', error.message)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
