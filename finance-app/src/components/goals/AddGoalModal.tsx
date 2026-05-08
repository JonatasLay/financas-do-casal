'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import { NumericFormat } from 'react-number-format'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  householdId: string
}

const ICONS = ['✈️','🏦','💰','🏠','🎓','🚗','💻','📱','🎁','🐾','💎','🌴','🎉','🍕','💪','🎸']
const COLORS = ['#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#0EA5E9','#F97316']

export function AddGoalModal({ open, onClose, onSuccess, householdId }: Props) {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [targetFloat, setTargetFloat] = useState(0)
  const [monthlyFloat, setMonthlyFloat] = useState(0)
  const [deadline, setDeadline] = useState('')
  const [icon, setIcon] = useState('🎯')
  const [color, setColor] = useState('#6366F1')
  const [description, setDescription] = useState('')

  const reset = () => {
    setName('')
    setTargetFloat(0)
    setMonthlyFloat(0)
    setDeadline('')
    setIcon('🎯')
    setColor('#6366F1')
    setDescription('')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return void toast.error('Digite um nome para a meta')
    if (targetFloat <= 0) return void toast.error('Informe o valor alvo')
    if (!householdId) return

    setSaving(true)
    try {
      const { error } = await supabase.from('goals').insert({
        household_id: householdId,
        name: name.trim(),
        description: description.trim() || null,
        target_amount: targetFloat,
        current_amount: 0,
        monthly_contribution: monthlyFloat,
        icon,
        color,
        deadline: deadline || null,
        is_completed: false,
      })
      if (error) throw error
      toast.success('Meta criada! 🎯')
      onSuccess()
      handleClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar meta')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full md:max-w-lg bg-white md:rounded-2xl rounded-t-3xl shadow-2xl animate-slide-up max-h-[92dvh] flex flex-col">
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Nova Meta</h2>
          <button onClick={handleClose} className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form id="goal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Ícone */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ícone</p>
            <div className="grid grid-cols-8 gap-1.5">
              {ICONS.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setIcon(em)}
                  className={`w-full aspect-square rounded-xl text-xl flex items-center justify-center transition-all duration-150
                    ${icon === em ? 'scale-110' : 'hover:bg-gray-50 border border-gray-100'}`}
                  style={icon === em
                    ? { outline: `2px solid ${color}`, outlineOffset: '2px', backgroundColor: color + '20' }
                    : {}}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cor</p>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all duration-150 flex-shrink-0
                    ${color === c ? 'scale-125 ring-2 ring-offset-2' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c, outlineColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div
            className="flex items-center gap-3 p-3.5 rounded-xl"
            style={{ backgroundColor: color + '15' }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
              style={{ backgroundColor: color + '30' }}
            >
              {icon}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{name || 'Nome da meta'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Meta do casal 💜</p>
            </div>
          </div>

          {/* Nome */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Nome</p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Viagem para a Europa, Carro novo..."
              className="input"
            />
          </div>

          {/* Descrição */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Descrição <span className="font-normal normal-case text-gray-400">(opcional)</span>
            </p>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Um sonho do casal..."
              className="input"
            />
          </div>

          {/* Valor alvo */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Valor alvo</p>
            <NumericFormat
              onValueChange={v => setTargetFloat(v.floatValue || 0)}
              thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale
              prefix="R$ " placeholder="R$ 0,00" inputMode="decimal"
              className="input text-lg font-bold text-gray-900"
            />
          </div>

          {/* Contribuição mensal */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Contribuição mensal
            </p>
            <NumericFormat
              onValueChange={v => setMonthlyFloat(v.floatValue || 0)}
              thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale
              prefix="R$ " placeholder="R$ 0,00" inputMode="decimal"
              className="input"
            />
            {monthlyFloat > 0 && targetFloat > 0 && (
              <p className="text-xs text-gray-400 mt-1.5 ml-1">
                ≈ {Math.ceil(targetFloat / monthlyFloat)} meses para atingir
              </p>
            )}
          </div>

          {/* Prazo */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Prazo <span className="font-normal normal-case text-gray-400">(opcional)</span>
            </p>
            <input
              type="date"
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="input"
            />
          </div>

          <div className="h-1" />
        </form>

        <div className="px-5 py-4 border-t border-gray-100">
          <button form="goal-form" type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Criando...' : `Criar Meta ${icon}`}
          </button>
        </div>
      </div>
    </div>
  )
}
