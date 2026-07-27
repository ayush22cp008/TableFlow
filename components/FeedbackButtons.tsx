'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/AuthContext'

interface FeedbackButtonsProps {
  orderId: string
  menuItemId?: string
}

export default function FeedbackButtons({ orderId, menuItemId }: FeedbackButtonsProps) {
  const { user } = useAuth()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState('')
  const [selected, setSelected] = useState<boolean | null>(null)

  async function handleSubmit(thumbsUp: boolean | null) {
    if (!user) return
    setLoading(true)
    setSelected(thumbsUp)
    await supabase.from('feedback').insert({
      order_id: orderId,
      menu_item_id: menuItemId ?? null,
      customer_id: user.id,
      thumbs_up: thumbsUp,
      comment: comment.trim() || null,
    })
    setLoading(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="text-sm text-green-400 flex items-center gap-1">
        ✓ Thanks for your feedback!
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">How was it?</span>
        <button
          onClick={() => handleSubmit(true)}
          disabled={loading}
          className={`text-xl transition-all hover:scale-110 ${selected === true ? 'opacity-100' : 'opacity-50'}`}
          title="Thumbs up"
        >
          👍
        </button>
        <button
          onClick={() => handleSubmit(false)}
          disabled={loading}
          className={`text-xl transition-all hover:scale-110 ${selected === false ? 'opacity-100' : 'opacity-50'}`}
          title="Thumbs down"
        >
          👎
        </button>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Leave a comment (optional)"
          className="flex-1 px-3 py-1.5 text-sm bg-gray-800/50 border border-gray-700 rounded-lg text-white outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {comment && (
          <button
            onClick={() => handleSubmit(null)}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}
