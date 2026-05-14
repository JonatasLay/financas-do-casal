'use client'

import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} style={{ color: '#C7D2FE' }}>{part.slice(2, -2)}</strong>
    }
    return <span key={index}>{part}</span>
  })
}

function formatTipText(tip: string) {
  const cleaned = tip
    .replace(/\\n/g, '\n')
    .replace(/\s*•\s*/g, '\n• ')
    .replace(/\s*-\s+\*\*/g, '\n- **')
    .replace(/^#+\s*/gm, '')
    .trim()

  const lines = cleaned
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)

  if (lines.length <= 1) {
    return <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{renderInlineMarkdown(cleaned)}</p>
  }

  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const isBullet = /^[-•]/.test(line)
        const text = line.replace(/^[-•]\s*/, '')
        return (
          <div key={index} className={isBullet ? 'flex gap-2 text-sm leading-relaxed' : 'text-sm leading-relaxed'}
            style={{ color: '#94A3B8' }}>
            {isBullet && <span className="mt-0.5" style={{ color: '#818CF8' }}>•</span>}
            <span>{renderInlineMarkdown(text)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function DailyTip({ month }: { month?: Date }) {
  const [tip, setTip]       = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const cacheKey = month
    ? `daily-tip-${month.getFullYear()}-${month.getMonth() + 1}`
    : 'daily-tip'

  const fetchTip = async () => {
    setLoading(true)
    try {
      const query = month ? `?month=${month.getMonth() + 1}&year=${month.getFullYear()}` : ''
      const res  = await fetch(`/api/ai/tip${query}`)
      const data = await res.json()
      setTip(data.tip)
      sessionStorage.setItem(cacheKey, data.tip)
    } catch { /* silencioso */ } finally { setLoading(false) }
  }

  useEffect(() => {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) setTip(cached)
    else fetchTip()
  }, [cacheKey])

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
          formatTipText(tip || '')
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
