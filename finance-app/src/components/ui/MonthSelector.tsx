'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, addMonths, subMonths, isFuture, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface MonthSelectorProps {
  value: Date
  onChange: (date: Date) => void
}

export function MonthSelector({ value, onChange }: MonthSelectorProps) {
  const canGoForward = !isFuture(startOfMonth(addMonths(value, 1)))

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        onClick={() => onChange(subMonths(value, 1))}
        className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-gray-500" />
      </button>

      <div className="bg-white border border-gray-200 rounded-xl px-4 py-1.5 min-w-32 text-center">
        <p className="text-sm font-semibold text-gray-900 capitalize">
          {format(value, 'MMMM yyyy', { locale: ptBR })}
        </p>
      </div>

      <button
        onClick={() => canGoForward && onChange(addMonths(value, 1))}
        disabled={!canGoForward}
        className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4 text-gray-500" />
      </button>
    </div>
  )
}
