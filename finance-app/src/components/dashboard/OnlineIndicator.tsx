'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface OnlineUser {
  name: string
  avatar_color: string
  avatar_emoji: string
}

export function OnlineIndicator({ householdId }: { householdId?: string }) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const supabase = createClient()

  useEffect(() => {
    if (!householdId) return

    const fetchOnlineStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('name, avatar_color, avatar_emoji')
        .eq('id', user.id)
        .single()

      if (profile) setOnlineUsers([profile])
    }

    fetchOnlineStatus()

    // Presence via Supabase Realtime
    const channel = supabase.channel(`presence:${householdId}`, {
      config: { presence: { key: householdId } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = Object.values(state).flat() as any[]
        setOnlineUsers(users.map(u => ({
          name: u.name,
          avatar_color: u.avatar_color || '#6366F1',
          avatar_emoji: u.avatar_emoji || '👤',
        })))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, avatar_color, avatar_emoji')
            .eq('household_id', householdId)
            .limit(1)
            .single()

          if (profile) {
            await channel.track({
              name: profile.name,
              avatar_color: profile.avatar_color,
              avatar_emoji: profile.avatar_emoji,
              online_at: new Date().toISOString(),
            })
          }
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [householdId])

  if (onlineUsers.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {onlineUsers.slice(0, 2).map((user, i) => (
          <div
            key={i}
            className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: user.avatar_color }}
            title={`${user.name} online`}
          >
            {user.name[0]}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
        <span className="text-xs text-gray-500">
          {onlineUsers.length === 1 ? onlineUsers[0].name.split(' ')[0] : 'Vocês dois'} online
        </span>
      </div>
    </div>
  )
}
