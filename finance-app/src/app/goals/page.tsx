'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { GoalCard } from '@/components/goals/GoalCard'
import { AddGoalModal } from '@/components/goals/AddGoalModal'
import { Plus, ChevronDown, ChevronUp } from 'lucide-react'
import type { Goal } from '@/types'

function GoalSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100/50 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="skeleton w-14 h-14 rounded-2xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="skeleton h-4 rounded w-32" />
          <div className="skeleton h-3 rounded w-20" />
        </div>
      </div>
      <div className="skeleton h-3 rounded-full" />
      <div className="flex justify-between">
        <div className="skeleton h-6 rounded w-24" />
        <div className="skeleton h-4 rounded w-20" />
      </div>
      <div className="skeleton h-10 rounded-xl" />
    </div>
  )
}

export default function GoalsPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  const fetchGoals = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    if (!prof?.household_id) { setLoading(false); return }

    const { data } = await supabase
      .from('goals')
      .select('*')
      .eq('household_id', prof.household_id)
      .order('created_at', { ascending: false })

    setGoals(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchGoals()

    const channel = supabase
      .channel('goals-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, fetchGoals)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goal_contributions' }, fetchGoals)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchGoals])

  const activeGoals = goals.filter(g => !g.is_completed && Number(g.current_amount) < g.target_amount)
  const completedGoals = goals.filter(g => g.is_completed || Number(g.current_amount) >= g.target_amount)

  const totalTarget = activeGoals.reduce((s, g) => s + g.target_amount, 0)
  const totalSaved = activeGoals.reduce((s, g) => s + Number(g.current_amount), 0)

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <AppLayout profile={profile}>
      <div className="pb-28 md:pb-8 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Metas do casal</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {loading ? '...' : `${activeGoals.length} ativa${activeGoals.length !== 1 ? 's' : ''}`}
              {completedGoals.length > 0 && ` · ${completedGoals.length} concluída${completedGoals.length !== 1 ? 's' : ''} 🎉`}
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-primary flex items-center gap-1.5 text-sm"
          >
            <Plus className="w-4 h-4" />
            Nova meta
          </button>
        </div>

        {/* Summary bar */}
        {!loading && activeGoals.length > 1 && (
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Progresso geral
              </p>
              <p className="text-sm font-bold text-primary-600">
                {totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%
              </p>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-2.5 rounded-full bg-gradient-card transition-all duration-700"
                style={{
                  width: `${totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0}%`
                }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <p className="text-xs text-gray-500">{fmt(totalSaved)} guardados</p>
              <p className="text-xs text-gray-400">de {fmt(totalTarget)}</p>
            </div>
          </div>
        )}

        {/* Active goals grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(3)].map((_, i) => <GoalSkeleton key={i} />)}
          </div>
        ) : activeGoals.length === 0 && completedGoals.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-6xl">🎯</p>
            <div>
              <p className="font-semibold text-gray-700">Nenhuma meta ainda</p>
              <p className="text-sm text-gray-400 mt-1">
                Crie sua primeira meta financeira juntos!
              </p>
            </div>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              Criar primeira meta ✨
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeGoals.map(goal => (
              <GoalCard key={goal.id} goal={goal} onRefresh={fetchGoals} />
            ))}
          </div>
        )}

        {/* Completed goals section */}
        {completedGoals.length > 0 && (
          <div>
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="w-full flex items-center justify-between py-3 px-1 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span>Metas concluídas ({completedGoals.length}) 🏆</span>
              {showCompleted
                ? <ChevronUp className="w-4 h-4" />
                : <ChevronDown className="w-4 h-4" />}
            </button>

            {showCompleted && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                {completedGoals.map(goal => (
                  <GoalCard key={goal.id} goal={goal} onRefresh={fetchGoals} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FAB mobile */}
      <button
        onClick={() => setShowModal(true)}
        className="md:hidden fixed bottom-24 right-5 w-14 h-14 bg-gradient-card rounded-2xl shadow-float flex items-center justify-center active:scale-95 transition-transform z-30"
        aria-label="Nova meta"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      <AddGoalModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchGoals}
        householdId={profile?.household_id || ''}
      />
    </AppLayout>
  )
}
