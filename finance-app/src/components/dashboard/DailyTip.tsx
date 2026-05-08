'use client'

import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

export function DailyTip() {
  const [tip, setTip]       = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchTip = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/ai/tip')
      const data = await res.json()
      setTip(data.tip)
      sessionStorage.setItem('daily-tip', data.tip)
      sessionStorage.setItem('daily-tip-date', new Date().toDateString())
    } catch { /* silencioso */ } finally { setLoading(false) }
  }

  useEffect(() => {
    const cached     = sessionStorage.getItem('daily-tip')
    const cachedDate = sessionStorage.getItem('daily-tip-date')
    if (cached && cachedDate === new Date().toDateString()) setTip(cached)
    else fetchTip()
  }, [])

  if (!tip && !loading) return null

  return (
    <div className="rounded-2xl p-4 flex gap-3"
      style={{
        background: 'linear-gradient(135deg, rgba(129,140,248,0.08), rgba(244,114,182,0.06))',
        border: '1px solid rgba(129,140,248,0.2)',
      }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'linear-gradient(135deg, #818CF8, #F472B6)', boxShadow: '0 0 16px rgba(129,140,248,0.4)' }}>
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold mb-1" style={{ color: '#818CF8' }}>💡 Dica da Fina</p>
        {loading ? (
          <div className="space-y-1">
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-3/4 rounded" />
          </div>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{tip}</p>
        )}
      </div>
      {!loading && (
        <button onClick={fetchTip} className="p-1 rounded-lg transition-colors flex-shrink-0" style={{ color: '#475569' }} title="Nova dica">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
