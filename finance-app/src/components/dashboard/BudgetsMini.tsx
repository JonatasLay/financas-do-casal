'use client'

import Link from 'next/link'
import { ChevronRight, AlertTriangle } from 'lucide-react'
import type { Budget, Transaction } from '@/types'

interface BudgetsMiniProps {
  budgets: Budget[]
  transactions: Transaction[]
  loading: boolean
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function BudgetsMini({ budgets, transactions, loading }: BudgetsMiniProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="skeleton h-5 w-44 mb-4 rounded" />
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="skeleton h-3.5 rounded w-24" />
                <div className="skeleton h-3.5 rounded w-20" />
              </div>
              <div className="skeleton h-2 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (budgets.length === 0) return null

  const spentByCategory: Record<string, number> = {}
  for (const tx of transactions) {
    if (tx.type === 'receita' || tx.status !== 'realizado' || !tx.category_id) continue
    spentByCategory[tx.category_id] = (spentByCategory[tx.category_id] || 0) + Number(tx.amount)
  }

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0)
  const totalSpent  = budgets.reduce((s, b) => s + (spentByCategory[b.category_id] || 0), 0)
  const overallPct  = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0
  const anyAlert    = budgets.some(b => {
    const spent = spentByCategory[b.category_id] || 0
    return spent > 0 && spent / Number(b.amount) >= 0.8
  })

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold" style={{ color: '#F1F5F9' }}>Orçamentos do mês</h2>
          {anyAlert && <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#FBBF24' }} />}
        </div>
        <Link href="/settings" className="text-xs font-medium flex items-center gap-1 transition-all hover:gap-2" style={{ color: '#818CF8' }}>
          Gerenciar <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Overall mini bar */}
      <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div
            className="h-1.5 rounded-full transition-all duration-700"
            style={{
              width: `${overallPct}%`,
              backgroundColor: overallPct >= 100 ? '#F87171' : overallPct >= 80 ? '#FB923C' : '#818CF8',
            }}
          />
        </div>
        <span className="text-xs font-semibold flex-shrink-0 w-8 text-right" style={{ color: '#64748B' }}>
          {overallPct}%
        </span>
      </div>

      <div className="space-y-3">
        {budgets.map(budget => {
          const spent  = spentByCategory[budget.category_id] || 0
          const limit  = Number(budget.amount)
          const pct    = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
          const over   = spent > limit
          const warn   = pct >= 80 && !over

          let barColor = '#34D399'
          if (pct >= 100) barColor = '#F87171'
          else if (pct >= 80) barColor = '#FB923C'
          else if (pct >= 60) barColor = '#FBBF24'

          return (
            <div key={budget.id}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base flex-shrink-0">{budget.category?.icon ?? '📦'}</span>
                  <span className="text-sm font-medium truncate" style={{ color: '#CBD5E1' }}>
                    {budget.category?.name ?? 'Categoria'}
                  </span>
                  {over && (
                    <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}>
                      Excedeu!
                    </span>
                  )}
                  {warn && (
                    <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}>
                      {pct}%
                    </span>
                  )}
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className="text-xs font-semibold" style={{ color: over ? '#F87171' : '#94A3B8' }}>
                    {fmt(spent)}
                  </span>
                  <span className="text-xs" style={{ color: '#475569' }}> / {fmt(limit)}</span>
                </div>
              </div>
              <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div
                  className="h-1.5 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
