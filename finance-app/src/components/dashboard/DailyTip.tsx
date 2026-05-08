'use client'

import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

export function DailyTip() {
  const [tip, setTip] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchTip = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/tip')
      const data = await res.json()
      setTip(data.tip)
      sessionStorage.setItem('daily-tip', data.tip)
      sessionStorage.setItem('daily-tip-date', new Date().toDateString())
    } catch {
      // silencioso — é opcional
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const cached = sessionStorage.getItem('daily-tip')
    const cachedDate = sessionStorage.getItem('daily-tip-date')
    if (cached && cachedDate === new Date().toDateString()) {
      setTip(cached)
    } else {
      fetchTip()
    }
  }, [])

  if (!tip && !loading) return null

  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 flex gap-3">
      <div className="w-8 h-8 bg-gradient-ai rounded-xl flex items-center justify-center flex-shrink-0">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-indigo-700 mb-0.5">💡 Dica da Fina</p>
        {loading ? (
          <div className="space-y-1">
            <div className="skeleton h-3 w-full rounded" />
            <div className="skeleton h-3 w-3/4 rounded" />
          </div>
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed">{tip}</p>
        )}
      </div>
      {!loading && (
        <button
          onClick={fetchTip}
          className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors flex-shrink-0"
          title="Nova dica"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
