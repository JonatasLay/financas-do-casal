'use client'

import { TrendingUp, TrendingDown, Clock } from 'lucide-react'

interface SummaryCardsProps {
  income: number
  expenses: number
  pending: number
  plannedIncome?: number
  plannedExpenses?: number
  viewLabel?: string
  loading: boolean
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function SummaryCards({ income, expenses, pending, plannedIncome = 0, plannedExpenses = 0, viewLabel = 'este mes', loading }: SummaryCardsProps) {
  const balance = income - expenses
  const projectedBalance = income + plannedIncome - expenses - plannedExpenses
  const spentPct = income > 0 ? Math.round((expenses / income) * 100) : 0

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Receita */}
      <div className="rounded-2xl p-4 col-span-1" style={{
        background: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(52,211,153,0.05))',
        border: '1px solid rgba(52,211,153,0.25)',
      }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium" style={{ color: '#34D399' }}>Receita</p>
          <TrendingUp className="w-4 h-4" style={{ color: '#34D399' }} />
        </div>
        <p className="text-xl font-bold font-mono-nums" style={{ color: '#F1F5F9' }}>{fmt(income)}</p>
        <p className="text-xs mt-1" style={{ color: '#64748B' }}>{plannedIncome > 0 ? `+ ${fmt(plannedIncome)} previsto` : viewLabel}</p>
      </div>

      {/* Despesa */}
      <div className="rounded-2xl p-4 col-span-1" style={{
        background: 'linear-gradient(135deg, rgba(248,113,113,0.15), rgba(248,113,113,0.05))',
        border: '1px solid rgba(248,113,113,0.25)',
      }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium" style={{ color: '#F87171' }}>Despesas</p>
          <TrendingDown className="w-4 h-4" style={{ color: '#F87171' }} />
        </div>
        <p className="text-xl font-bold font-mono-nums" style={{ color: '#F1F5F9' }}>{fmt(expenses)}</p>
        <p className="text-xs mt-1" style={{ color: '#64748B' }}>{plannedExpenses > 0 ? `+ ${fmt(plannedExpenses)} previsto` : `${spentPct}% da renda`}</p>
      </div>

      {/* Saldo */}
      <div className="rounded-2xl p-4 col-span-1" style={{
        background: balance >= 0
          ? 'linear-gradient(135deg, rgba(129,140,248,0.15), rgba(129,140,248,0.05))'
          : 'linear-gradient(135deg, rgba(248,113,113,0.15), rgba(248,113,113,0.05))',
        border: `1px solid ${balance >= 0 ? 'rgba(129,140,248,0.25)' : 'rgba(248,113,113,0.25)'}`,
      }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>Saldo</p>
          <span className="text-base">{balance >= 0 ? '✅' : '⚠️'}</span>
        </div>
        <p className="text-xl font-bold font-mono-nums" style={{ color: balance >= 0 ? '#818CF8' : '#F87171' }}>
          {balance >= 0 ? '+' : ''}{fmt(balance)}
        </p>
        <p className="text-xs mt-1" style={{ color: '#64748B' }}>Projetado: {projectedBalance >= 0 ? '+' : ''}{fmt(projectedBalance)}</p>
      </div>

      {/* Previsto */}
      <div className="rounded-2xl p-4 col-span-1" style={{
        background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(251,191,36,0.05))',
        border: '1px solid rgba(251,191,36,0.25)',
      }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium" style={{ color: '#FBBF24' }}>Previsto</p>
          <Clock className="w-4 h-4" style={{ color: '#FBBF24' }} />
        </div>
        <p className="text-xl font-bold font-mono-nums" style={{ color: '#F1F5F9' }}>{fmt(pending)}</p>
        <p className="text-xs mt-1" style={{ color: '#64748B' }}>despesas e faturas</p>
      </div>
    </div>
  )
}
