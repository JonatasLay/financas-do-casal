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

  // Compute spent per category from current-month transactions
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
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-900">Orçamentos do mês</h2>
          {anyAlert && (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          )}
        </div>
        <Link
          href="/settings"
          className="text-xs text-primary-600 font-medium flex items-center gap-1 hover:gap-2 transition-all"
        >
          Gerenciar <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Overall mini bar */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-50">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-1.5 rounded-full transition-all duration-700"
            style={{
              width: `${overallPct}%`,
              backgroundColor: overallPct >= 100 ? '#EF4444' : overallPct >= 80 ? '#F97316' : '#6366F1',
            }}
          />
        </div>
        <span className="text-xs font-semibold text-gray-500 flex-shrink-0 w-8 text-right">
          {overallPct}%
        </span>
      </div>

      {/* Per-category rows */}
      <div className="space-y-3">
        {budgets.map(budget => {
          const spent  = spentByCategory[budget.category_id] || 0
          const limit  = Number(budget.amount)
          const pct    = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
          const over   = spent > limit
          const warn   = pct >= 80 && !over

          let barColor = '#10B981'
          if (pct >= 100) barColor = '#EF4444'
          else if (pct >= 80) barColor = '#F97316'
          else if (pct >= 60) barColor = '#F59E0B'

          return (
            <div key={budget.id}>
              <div className="flex items-center justify-between mb-1.5">
                {/* Category */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base flex-shrink-0">
                    {budget.category?.icon ?? '📦'}
                  </span>
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {budget.category?.name ?? 'Categoria'}
                  </span>
                  {over && (
                    <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                      Excedeu!
                    </span>
                  )}
                  {warn && (
                    <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">
                      {pct}%
                    </span>
                  )}
                </div>

                {/* Values */}
                <div className="text-right flex-shrink-0 ml-2">
                  <span className={`text-xs font-semibold ${over ? 'text-red-500' : 'text-gray-600'}`}>
                    {fmt(spent)}
                  </span>
                  <span className="text-xs text-gray-400"> / {fmt(limit)}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
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
