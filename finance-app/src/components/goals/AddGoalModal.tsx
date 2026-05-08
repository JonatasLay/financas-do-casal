'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import { NumericFormat } from 'react-number-format'
import { toast } from 'sonner'
import type { Goal } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  householdId: string
  editGoal?: Goal | null
}

const ICONS  = ['✈️','🏦','💰','🏠','🎓','🚗','💻','📱','🎁','🐾','💎','🌴','🎉','🍕','💪','🎸']
const COLORS = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#0EA5E9','#F97316']

export function AddGoalModal({ open, onClose, onSuccess, householdId, editGoal }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const isEdit = !!editGoal

  const [name, setName]               = useState('')
  const [targetFloat, setTargetFloat] = useState(0)
  const [monthlyFloat, setMonthlyFloat] = useState(0)
  const [deadline, setDeadline]       = useState('')
  const [icon, setIcon]               = useState('🎯')
  const [color, setColor]             = useState('#6366F1')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (editGoal) {
      setName(editGoal.name)
      setTargetFloat(Number(editGoal.target_amount))
      setMonthlyFloat(Number(editGoal.monthly_contribution))
      setDeadline(editGoal.deadline || '')
      setIcon(editGoal.icon)
      setColor(editGoal.color)
      setDescription(editGoal.description || '')
    } else if (open) {
      setName(''); setTargetFloat(0); setMonthlyFloat(0)
      setDeadline(''); setIcon('🎯'); setColor('#6366F1'); setDescription('')
    }
  }, [editGoal, open])

  const handleClose = () => { onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return void toast.error('Digite um nome para a meta')
    if (targetFloat <= 0) return void toast.error('Informe o valor alvo')
    if (!householdId) return

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        target_amount: targetFloat,
        monthly_contribution: monthlyFloat,
        icon,
        color,
        deadline: deadline || null,
      }

      if (isEdit && editGoal) {
        const { error } = await supabase.from('goals').update(payload).eq('id', editGoal.id)
        if (error) throw error
        toast.success('Meta atualizada! ✏️')
      } else {
        const { error } = await supabase.from('goals').insert({
          ...payload,
          household_id: householdId,
          current_amount: 0,
          is_completed: false,
        })
        if (error) throw error
        toast.success('Meta criada! 🎯')
      }
      onSuccess(); handleClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar meta')
    } finally { setSaving(false) }
  }

  if (!open) return null

  const cardBg  = 'rgba(13,13,26,0.99)'
  const borderC = 'rgba(129,140,248,0.22)'
  const labelC  = '#64748B'

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full md:max-w-lg md:rounded-2xl rounded-t-3xl shadow-2xl animate-slide-up max-h-[92dvh] flex flex-col"
        style={{ background: cardBg, border: `1px solid ${borderC}` }}>
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${borderC}` }}>
          <h2 className="font-bold" style={{ color: '#F1F5F9' }}>
            {isEdit ? '✏️ Editar Meta' : 'Nova Meta 🎯'}
          </h2>
          <button onClick={handleClose} className="p-1.5 rounded-xl transition-colors" style={{ color: '#64748B' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form id="goal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Ícone */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Ícone</p>
            <div className="grid grid-cols-8 gap-1.5">
              {ICONS.map(em => (
                <button key={em} type="button" onClick={() => setIcon(em)}
                  className="w-full aspect-square rounded-xl text-xl flex items-center justify-center transition-all duration-150"
                  style={icon === em
                    ? { outline: `2px solid ${color}`, outlineOffset: '2px', backgroundColor: color + '20', transform: 'scale(1.1)' }
                    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Cor</p>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition-all duration-150 flex-shrink-0"
                  style={{ backgroundColor: c, outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: '3px', transform: color === c ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl" style={{ backgroundColor: color + '12' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: color + '25' }}>{icon}</div>
            <div>
              <p className="font-semibold" style={{ color: '#F1F5F9' }}>{name || 'Nome da meta'}</p>
              <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Meta do casal 💜</p>
            </div>
          </div>

          {/* Nome */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Nome</p>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Viagem para a Europa, Carro novo..." className="input" />
          </div>

          {/* Descrição */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>
              Descrição <span className="font-normal normal-case" style={{ color: '#334155' }}>(opcional)</span>
            </p>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Um sonho do casal..." className="input" />
          </div>

          {/* Valor alvo */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Valor alvo</p>
            <NumericFormat
              value={targetFloat || ''}
              onValueChange={v => setTargetFloat(v.floatValue || 0)}
              thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale
              prefix="R$ " placeholder="R$ 0,00" inputMode="decimal"
              className="input text-lg font-bold"
            />
          </div>

          {/* Contribuição mensal */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>
              Contribuição mensal
            </p>
            <NumericFormat
              value={monthlyFloat || ''}
              onValueChange={v => setMonthlyFloat(v.floatValue || 0)}
              thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale
              prefix="R$ " placeholder="R$ 0,00" inputMode="decimal"
              className="input"
            />
            {monthlyFloat > 0 && targetFloat > 0 && (
              <p className="text-xs mt-1.5 ml-1" style={{ color: '#475569' }}>
                ≈ {Math.ceil(targetFloat / monthlyFloat)} meses para atingir
              </p>
            )}
          </div>

          {/* Prazo */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>
              Prazo <span className="font-normal normal-case" style={{ color: '#334155' }}>(opcional)</span>
            </p>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="input" />
          </div>

          <div className="h-1" />
        </form>

        <div className="px-5 py-4" style={{ borderTop: `1px solid ${borderC}` }}>
          <button form="goal-form" type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Salvando...' : isEdit ? `Salvar Alterações ✏️` : `Criar Meta ${icon}`}
          </button>
        </div>
      </div>
    </div>
  )
}
