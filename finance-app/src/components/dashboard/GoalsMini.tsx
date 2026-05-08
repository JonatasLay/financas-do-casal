'use client'

import Link from 'next/link'
import { Goal } from '@/types'
import { ChevronRight } from 'lucide-react'

interface GoalsMiniProps {
  goals: Goal[]
  loading: boolean
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getMonthsLeft(goal: Goal): string {
  const remaining = goal.target_amount - goal.current_amount
  if (remaining <= 0) return 'Concluída! 🎉'
  if (goal.monthly_contribution <= 0) return 'Defina uma contribuição'
  const months = Math.ceil(remaining / goal.monthly_contribution)
  if (months === 1) return '1 mês'
  if (months > 120) return 'Defina uma contribuição maior'
  return `~${months} meses`
}

export function GoalsMini({ goals, loading }: GoalsMiniProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="skeleton h-5 w-32 mb-4 rounded" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">Metas do casal</h2>
        <Link href="/goals" className="text-xs text-primary-600 font-medium flex items-center gap-1 hover:gap-2 transition-all">
          Ver todas <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-3xl mb-2">🎯</p>
          <p className="text-sm text-gray-500">Nenhuma meta ainda</p>
          <Link href="/goals" className="text-xs text-primary-600 font-medium mt-1 block">
            Criar primeira meta →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => {
            const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
            return (
              <Link key={goal.id} href="/goals" className="block hover:bg-gray-50 rounded-xl p-2 -m-2 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: goal.color + '20' }}
                  >
                    {goal.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{goal.name}</p>
                      <span className="text-xs font-bold ml-2 flex-shrink-0" style={{ color: goal.color }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: goal.color }}
                      />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">{fmt(goal.current_amount)} de {fmt(goal.target_amount)}</span>
                      <span className="text-xs text-gray-400">{getMonthsLeft(goal)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
