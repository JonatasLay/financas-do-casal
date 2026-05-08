'use client'

import { CreditCard, AlertCircle } from 'lucide-react'
import type { Bank, Transaction } from '@/types'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'

interface Props {
  banks: Bank[]
  transactions: Transaction[]
  loading?: boolean
  selectedMonth?: Date
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function CardSkeleton() {
  return (
    <div className="p-4 rounded-2xl space-y-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-3">
        <div className="skeleton w-9 h-9 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <div className="skeleton h-3.5 rounded w-28" />
          <div className="skeleton h-3 rounded w-20" />
        </div>
        <div className="skeleton h-4 rounded w-16" />
      </div>
      <div className="skeleton h-2 rounded-full" />
      <div className="flex justify-between">
        <div className="skeleton h-3 rounded w-20" />
        <div className="skeleton h-3 rounded w-16" />
      </div>
    </div>
  )
}

export function CreditCardSummary({ banks, transactions, loading, selectedMonth = new Date() }: Props) {
  const creditCards = banks.filter(b => b.type === 'credito')

  if (!loading && creditCards.length === 0) return null

  const getSpent = (card: Bank) =>
    transactions
      .filter(t => {
        if (t.bank_id !== card.id || t.type === 'receita' || t.status !== 'realizado') return false
        return isDateInMonth(getCreditCardPaymentDate(t.date, card.due_day), selectedMonth)
      })
      .reduce((s, t) => s + Number(t.amount), 0)

  const totalLimit = creditCards.reduce((s, c) => s + (Number(c.limit_amount) || 0), 0)
  const totalSpent = creditCards.reduce((s, c) => s + getSpent(c), 0)
  const usagePct   = totalLimit > 0 ? Math.min(100, (totalSpent / totalLimit) * 100) : 0

  const usageColor = usagePct >= 90 ? '#F87171' : usagePct >= 70 ? '#FBBF24' : '#818CF8'

  return (
    <div className="card space-y-4" style={{ border: '1px solid rgba(129,140,248,0.15)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)', boxShadow: '0 0 16px rgba(129,140,248,0.3)' }}>
            <CreditCard className="w-4 h-4 text-white" />
          </div>
          <p className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>Cartões de Crédito</p>
        </div>
        {totalLimit > 0 && (
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: usageColor }}>{usagePct.toFixed(0)}% usado</p>
            <p className="text-[10px]" style={{ color: '#475569' }}>{brl(totalSpent)} de {brl(totalLimit)}</p>
          </div>
        )}
      </div>

      {/* Total usage bar */}
      {totalLimit > 0 && (
        <div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{ width: `${usagePct}%`, background: `linear-gradient(90deg, #818CF8, ${usageColor})` }} />
          </div>
          {usagePct >= 80 && (
            <div className="flex items-center gap-1 mt-1.5">
              <AlertCircle className="w-3 h-3 flex-shrink-0" style={{ color: usageColor }} />
              <p className="text-[10px]" style={{ color: usageColor }}>
                {usagePct >= 90 ? 'Limite quase esgotado!' : 'Uso elevado do limite'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Per-card list */}
      <div className="space-y-2.5">
        {loading
          ? [1, 2].map(i => <CardSkeleton key={i} />)
          : creditCards.map(card => {
              const spent   = getSpent(card)
              const limit   = Number(card.limit_amount) || 0
              const cardPct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
              const color   = card.color || '#818CF8'
              const cardUsageColor = cardPct >= 90 ? '#F87171' : cardPct >= 70 ? '#FBBF24' : color

              return (
                <div key={card.id} className="p-3.5 rounded-2xl space-y-2.5"
                  style={{ background: `${color}08`, border: `1px solid ${color}20` }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                      style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                      {card.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{card.name}</p>
                      {card.due_day && (
                        <p className="text-[10px]" style={{ color: '#475569' }}>Venc. dia {card.due_day}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold font-mono-nums" style={{ color: cardUsageColor }}>{brl(spent)}</p>
                      {limit > 0 && (
                        <p className="text-[10px]" style={{ color: '#475569' }}>de {brl(limit)}</p>
                      )}
                    </div>
                  </div>

                  {limit > 0 && (
                    <div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${cardPct}%`, background: `linear-gradient(90deg, ${color}, ${cardUsageColor})` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <p className="text-[10px]" style={{ color: '#475569' }}>{cardPct.toFixed(0)}% do limite</p>
                        {limit > 0 && (
                          <p className="text-[10px]" style={{ color: '#334155' }}>Disponível: {brl(Math.max(0, limit - spent))}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
        }
      </div>
    </div>
  )
}
