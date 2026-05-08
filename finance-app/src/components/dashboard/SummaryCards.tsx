'use client'

import { TrendingUp, TrendingDown, Clock } from 'lucide-react'

interface SummaryCardsProps {
  income: number
  expenses: number
  pending: number
  loading: boolean
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function SummaryCards({ income, expenses, pending, loading }: SummaryCardsProps) {
  const balance = income - expenses
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
      <div className="bg-gradient-income rounded-2xl p-4 text-white col-span-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-emerald-100">Receita</p>
          <TrendingUp className="w-4 h-4 text-emerald-200" />
        </div>
        <p className="text-xl font-bold font-mono-nums">{fmt(income)}</p>
        <p className="text-xs text-emerald-100 mt-1">este mês</p>
      </div>

      {/* Despesa */}
      <div className="bg-gradient-expense rounded-2xl p-4 text-white col-span-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-red-100">Despesas</p>
          <TrendingDown className="w-4 h-4 text-red-200" />
        </div>
        <p className="text-xl font-bold font-mono-nums">{fmt(expenses)}</p>
        <p className="text-xs text-red-100 mt-1">{spentPct}% da renda</p>
      </div>

      {/* Saldo */}
      <div className={`rounded-2xl p-4 col-span-1 ${balance >= 0 ? 'bg-indigo-50 border border-indigo-100' : 'bg-red-50 border border-red-100'}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500">Saldo</p>
          <span className="text-base">{balance >= 0 ? '✅' : '⚠️'}</span>
        </div>
        <p className={`text-xl font-bold font-mono-nums ${balance >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>
          {balance >= 0 ? '+' : ''}{fmt(balance)}
        </p>
        <p className="text-xs text-gray-400 mt-1">{balance >= 0 ? 'superávit' : 'déficit'}</p>
      </div>

      {/* Pendentes */}
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 col-span-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-gray-500">Pendentes</p>
          <Clock className="w-4 h-4 text-amber-400" />
        </div>
        <p className="text-xl font-bold font-mono-nums text-amber-700">{fmt(pending)}</p>
        <p className="text-xs text-gray-400 mt-1">a pagar</p>
      </div>
    </div>
  )
}
