'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell } from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { supabase } from '@/lib/supabase'
import type { AppNotification } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function NotificationBell({ userId, role }: { userId: string; role: string }) {
  const [open, setOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  // Fetch + realtime subscription — Antigravity to wire up against
  // `notifications` + `notification_reads` tables per Node 9 schema.
  // Query pattern (unread count) is documented in
  // Chat16_Node9_ClaudeSpec_SchemaDesign.md — reuse that exact query.

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
                // onClick: mark as read — Antigravity to wire up insert into notification_reads
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
