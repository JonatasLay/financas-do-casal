'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface Rate {
  bid: string
  pctChange: string
  high: string
  low: string
}

export function DollarRate() {
  const [rate, setRate] = useState<Rate | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch_ = () =>
      fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL')
        .then(r => r.json())
        .then(d => { setRate(d.USDBRL); setLoading(false) })
        .catch(() => setLoading(false))

    fetch_()
    const id = setInterval(fetch_, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const change = rate ? parseFloat(rate.pctChange) : 0
  const up     = change >= 0
  const color  = up ? '#F87171' : '#34D399' // dólar subindo é ruim p/ brasileiro

  if (loading) return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-sm">🇺🇸</span>
      <div className="skeleton h-3.5 w-16 rounded" />
    </div>
  )

  if (!rate) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      title={`Alta: R$ ${parseFloat(rate.high).toFixed(2)} · Baixa: R$ ${parseFloat(rate.low).toFixed(2)}`}>
      <span className="text-sm">🇺🇸</span>
      <span className="text-sm font-bold font-mono-nums" style={{ color: '#F1F5F9' }}>
        R$ {parseFloat(rate.bid).toFixed(2)}
      </span>
      <div className="flex items-center gap-0.5">
        {up ? <TrendingUp className="w-3 h-3" style={{ color }} /> : <TrendingDown className="w-3 h-3" style={{ color }} />}
        <span className="text-[10px] font-medium" style={{ color }}>
          {up ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
    </div>
  )
}
