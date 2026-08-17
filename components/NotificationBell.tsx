'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/types'

export default function NotificationBell({ userId, role }: { userId: string; role: string }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  // Click-outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch unread notifications on mount
  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select(`
        id, recipient_role, recipient_id, order_id, reservation_id, type, message, created_at,
        notification_reads!left(id)
      `)
      .or(`recipient_id.eq.${userId},recipient_role.eq.${role}`)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error || !data) return

    const all = data as (AppNotification & { notification_reads: { id: string }[] })[]

    // Unread = no entry in notification_reads for this user
    const unread = all.filter((n) => n.notification_reads.length === 0)
    setNotifications(all)
    setUnreadCount(unread.length)
  }, [userId, role])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Realtime subscription for new notifications
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const n = payload.new as AppNotification
          // Filter client-side to this user's role or direct recipient
          if (n.recipient_role === role || n.recipient_id === userId) {
            setNotifications((prev) => [n, ...prev])
            setUnreadCount((prev) => prev + 1)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, role])

  // Mark as read -- insert into notification_reads
  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notification_reads')
      .insert({ notification_id: notificationId, user_id: userId })

    if (!error) {
      setUnreadCount((prev) => Math.max(0, prev - 1))
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-medium rounded-full h-4 w-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-lg shadow-lg z-50">
          {notifications.length === 0 ? (
            <div className="p-4 text-sm text-gray-400 text-center">No notifications</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className="p-3 border-b border-gray-800 last:border-0 hover:bg-gray-800/50 cursor-pointer"
                onClick={() => markAsRead(n.id)}
              >
                <p className="text-sm text-white">{n.message}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}