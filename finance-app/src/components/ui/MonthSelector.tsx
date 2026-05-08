'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths, differenceInCalendarMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface MonthSelectorProps {
  value: Date
  onChange: (date: Date) => void
  maxFutureMonths?: number
}

export function MonthSelector({ value, onChange, maxFutureMonths = 12 }: MonthSelectorProps) {
  const nextMonth = startOfMonth(addMonths(value, 1))
  const canGoForward = differenceInCalendarMonths(nextMonth, startOfMonth(new Date())) <= maxFutureMonths

  const btnStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(129,140,248,0.2)',
    color: '#818CF8',
  }

  return (
    <div className="flex items-center justify-center gap-3">
      <button onClick={() => onChange(subMonths(value, 1))}
        className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
        style={btnStyle}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.12)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="rounded-xl px-4 py-1.5 min-w-32 text-center"
        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(129,140,248,0.2)' }}>
        <p className="text-sm font-semibold capitalize" style={{ color: '#F1F5F9' }}>
          {format(value, 'MMMM yyyy', { locale: ptBR })}
        </p>
      </div>

      <button
        onClick={() => canGoForward && onChange(addMonths(value, 1))}
        disabled={!canGoForward}
        className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        style={btnStyle}
        onMouseEnter={e => { if (canGoForward) e.currentTarget.style.background = 'rgba(129,140,248,0.12)' }}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}>
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
