'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChevronDown, ChevronUp, Plus, Pencil, Trash2 } from 'lucide-react'
import { NumericFormat } from 'react-number-format'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Goal, GoalContribution, Profile } from '@/types'

type ContributionRow = GoalContribution & {
  profile?: Pick<Profile, 'name' | 'avatar_color' | 'avatar_emoji'>
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function projection(goal: Goal): string {
  const remaining = goal.target_amount - goal.current_amount
  if (remaining <= 0) return 'Concluída! 🎉'
  if (goal.monthly_contribution <= 0) return 'Defina uma contribuição mensal'
  const months = Math.ceil(remaining / goal.monthly_contribution)
  if (months > 120) return 'Contribuição insuficiente'
  return `em ~${months} ${months === 1 ? 'mês' : 'meses'}`
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = ['#818CF8', '#34D399', '#FBBF24', '#F87171', '#F472B6', '#22D3EE']

function Confetti() {
  const pieces = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${4 + (i * 3.9) % 92}%`,
    delay: `${((i * 0.11) % 0.7).toFixed(2)}s`,
    dur: `${(0.8 + (i * 0.07) % 0.9).toFixed(2)}s`,
    size: i % 3 === 0 ? 6 : 8,
  }))

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-10">
      {pieces.map(p => (
        <div key={p.id} style={{
          position: 'absolute', top: 0, left: p.left,
          width: p.size, height: p.size, backgroundColor: p.color,
          borderRadius: p.id % 2 === 0 ? '50%' : '2px',
          animation: `cfall ${p.dur} ease-in ${p.delay} forwards`,
        }} />
      ))}
    </div>
  )
}

// ─── ContributeModal ─────────────────────────────────────────────────────────

function ContributeModal({ goal, onClose, onSuccess }: { goal: Goal; onClose: () => void; onSuccess: () => void }) {
  const supabase = createClient()
  const [amountFloat, setAmountFloat] = useState(goal.monthly_contribution > 0 ? goal.monthly_contribution : 0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amountFloat <= 0) return void toast.error('Informe um valor')
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')
      const newAmount = Number(goal.current_amount) + amountFloat
      const isNowComplete = newAmount >= goal.target_amount
      const [contribRes, goalRes] = await Promise.all([
        supabase.from('goal_contributions').insert({
          goal_id: goal.id, household_id: goal.household_id, created_by: user.id,
          amount: amountFloat, date: format(new Date(), 'yyyy-MM-dd'), notes: notes.trim() || null,
        }),
        supabase.from('goals').update({ current_amount: newAmount, is_completed: isNowComplete }).eq('id', goal.id),
      ])
      if (contribRes.error) throw contribRes.error
      if (goalRes.error) throw goalRes.error
      toast.success(isNowComplete ? 'Meta concluída! 🎉🎉' : 'Contribuição adicionada! 💪')
      onSuccess(); onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao contribuir')
    } finally { setSaving(false) }
  }

  const cardBg  = 'rgba(13,13,26,0.99)'
  const borderC = 'rgba(129,140,248,0.25)'

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-sm md:rounded-2xl rounded-t-3xl shadow-2xl animate-slide-up"
        style={{ background: cardBg, border: `1px solid ${borderC}` }}>
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div className="px-5 pt-4 pb-2" style={{ borderBottom: `1px solid ${borderC}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ backgroundColor: goal.color + '25' }}>
              {goal.icon}
            </div>
            <div>
              <p className="font-bold text-sm" style={{ color: '#F1F5F9' }}>{goal.name}</p>
              <p className="text-xs" style={{ color: '#64748B' }}>
                Falta {fmt(Math.max(0, goal.target_amount - goal.current_amount))}
              </p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>Valor</p>
            <NumericFormat
              defaultValue={goal.monthly_contribution > 0 ? goal.monthly_contribution : undefined}
              onValueChange={v => setAmountFloat(v.floatValue || 0)}
              thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale
              prefix="R$ " placeholder="R$ 0,00" inputMode="decimal"
              className="input text-lg font-bold" autoFocus
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>
              Observação <span className="font-normal normal-case" style={{ color: '#334155' }}>(opcional)</span>
            </p>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Guardei do salário..." className="input" />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Salvando...' : 'Contribuir 💰'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── GoalCard ─────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: Goal
  onRefresh: () => void
  onEdit?: (goal: Goal) => void
}

export function GoalCard({ goal, onRefresh, onEdit }: GoalCardProps) {
  const supabase = createClient()
  const [showContribute, setShowContribute] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [contributions, setContributions] = useState<ContributionRow[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const prevPct = useRef(0)

  const pct = Math.min(
    100,
    goal.target_amount > 0 ? Math.round((Number(goal.current_amount) / goal.target_amount) * 100) : 0
  )
  const isCompleted = pct >= 100

  useEffect(() => {
    if (pct >= 100 && prevPct.current < 100) {
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(t)
    }
    prevPct.current = pct
  }, [pct])

  const loadHistory = async () => {
    if (showHistory) { setShowHistory(false); return }
    setShowHistory(true)
    if (contributions.length > 0) return
    setLoadingHistory(true)
    const { data } = await supabase
      .from('goal_contributions')
      .select('*, profile:profiles(name, avatar_color, avatar_emoji)')
      .eq('goal_id', goal.id)
      .order('date', { ascending: false })
      .limit(30)
    setContributions((data as ContributionRow[]) || [])
    setLoadingHistory(false)
  }

  const handleDelete = async () => {
    const { error } = await supabase.from('goals').delete().eq('id', goal.id)
    if (error) toast.error('Erro ao excluir meta')
    else { toast.success('Meta excluída'); onRefresh() }
    setConfirmDelete(false)
  }

  const proj = projection(goal)
  const remaining = Math.max(0, goal.target_amount - Number(goal.current_amount))

  return (
    <>
      <div className="rounded-2xl overflow-hidden relative"
        style={{ background: 'rgba(17,17,36,0.85)', border: '1px solid rgba(129,140,248,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
        {showConfetti && <Confetti />}

        {/* Color stripe */}
        <div className="h-1.5 w-full" style={{ backgroundColor: goal.color }} />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ backgroundColor: goal.color + '20' }}>
                {goal.icon}
              </div>
              <div>
                <h3 className="font-bold leading-tight" style={{ color: '#F1F5F9' }}>{goal.name}</h3>
                {goal.description && (
                  <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{goal.description}</p>
                )}
                {goal.deadline && (
                  <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                    Prazo: {format(new Date(goal.deadline + 'T12:00:00'), "MMM 'de' yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {isCompleted ? (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
                  Concluída! 🎉
                </span>
              ) : (
                <span className="text-sm font-extrabold" style={{ color: goal.color }}>{pct}%</span>
              )}
              {onEdit && (
                <button onClick={() => onEdit(goal)}
                  className="p-1.5 rounded-lg transition-colors ml-1"
                  style={{ color: '#818CF8' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  title="Editar">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#F87171' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title="Excluir">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full rounded-full h-3 mb-3 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <div className="h-3 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${pct}%`, backgroundColor: goal.color }} />
          </div>

          {/* Valores */}
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-lg font-extrabold" style={{ color: '#F1F5F9' }}>
                {fmt(Number(goal.current_amount))}
              </p>
              <p className="text-xs" style={{ color: '#475569' }}>de {fmt(goal.target_amount)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>
                {remaining > 0 ? fmt(remaining) + ' restam' : 'Meta atingida!'}
              </p>
              <p className="text-xs font-medium mt-0.5" style={{ color: isCompleted ? '#34D399' : goal.color }}>
                {proj}
              </p>
            </div>
          </div>

          {goal.monthly_contribution > 0 && !isCompleted && (
            <p className="text-xs mb-4" style={{ color: '#475569' }}>
              Contribuição mensal: {fmt(goal.monthly_contribution)}
            </p>
          )}

          {/* Contribute button */}
          {!isCompleted && (
            <button onClick={() => setShowContribute(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all duration-150 hover:opacity-80 mt-3"
              style={{ borderColor: goal.color + '60', color: goal.color, borderStyle: 'dashed' }}>
              <Plus className="w-4 h-4" />
              Contribuir
            </button>
          )}

          {/* History toggle */}
          <button onClick={loadHistory}
            className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 text-xs font-medium transition-colors"
            style={{ color: '#475569' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#94A3B8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showHistory ? 'Fechar histórico' : 'Ver histórico de contribuições'}
          </button>

          {/* History */}
          {showHistory && (
            <div className="mt-2 pt-3 space-y-2 animate-fade-in" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {loadingHistory ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-10 rounded-xl" />)}
                </div>
              ) : contributions.length === 0 ? (
                <p className="text-xs text-center py-3" style={{ color: '#475569' }}>Nenhuma contribuição ainda</p>
              ) : (
                contributions.map(c => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    {c.profile && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: c.profile.avatar_color || '#6366F1' }}>
                        {c.profile.avatar_emoji || c.profile.name?.[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs" style={{ color: '#64748B' }}>
                        {format(new Date(c.date + 'T12:00:00'), "dd 'de' MMMM", { locale: ptBR })}
                        {c.profile && ` · ${c.profile.name?.split(' ')[0]}`}
                      </p>
                      {c.notes && <p className="text-xs truncate" style={{ color: '#475569' }}>{c.notes}</p>}
                    </div>
                    <p className="text-sm font-bold flex-shrink-0" style={{ color: '#34D399' }}>
                      +{fmt(Number(c.amount))}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {showContribute && (
        <ContributeModal
          goal={goal}
          onClose={() => setShowContribute(false)}
          onSuccess={() => { setContributions([]); onRefresh() }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir meta?"
        message={`A meta "${goal.name}" será excluída permanentemente, junto com todo o histórico de contribuições.`}
        confirmLabel="Excluir meta"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  )
}
