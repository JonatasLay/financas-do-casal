'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import { NumericFormat } from 'react-number-format'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { Category, Bank, TransactionType, TransactionStatus } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const TYPES: { value: TransactionType; label: string; active: string }[] = [
  { value: 'despesa',       label: '💸 Despesa',   active: 'border-red-400 bg-red-50 text-red-700' },
  { value: 'receita',       label: '💰 Receita',   active: 'border-emerald-400 bg-emerald-50 text-emerald-700' },
  { value: 'fatura',        label: '💳 Fatura',    active: 'border-orange-400 bg-orange-50 text-orange-700' },
  { value: 'transferencia', label: '🔄 Transfer.', active: 'border-blue-400 bg-blue-50 text-blue-700' },
]

const STATUSES: { value: TransactionStatus; label: string; icon: string }[] = [
  { value: 'realizado', label: 'Realizado', icon: '✅' },
  { value: 'pendente',  label: 'Pendente',  icon: '⏳' },
  { value: 'agendado',  label: 'Agendado',  icon: '📅' },
]

export function AddTransactionModal({ open, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [saving, setSaving] = useState(false)

  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [description, setDescription] = useState('')
  const [amountFloat, setAmountFloat] = useState(0)
  const [type, setType] = useState<TransactionType>('despesa')
  const [categoryId, setCategoryId] = useState('')
  const [bankId, setBankId] = useState('')
  const [status, setStatus] = useState<TransactionStatus>('realizado')
  const [notes, setNotes] = useState('')
  const [isRecurring, setIsRecurring] = useState(false)

  useEffect(() => {
    if (!open) return
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      if (!prof?.household_id) return
      const [cRes, bRes] = await Promise.all([
        supabase.from('categories').select('*').eq('household_id', prof.household_id).order('name'),
        supabase.from('banks').select('*').eq('household_id', prof.household_id).order('name'),
      ])
      setCategories(cRes.data || [])
      setBanks(bRes.data || [])
    }
    load()
  }, [open])

  useEffect(() => { setCategoryId('') }, [type])

  const visibleCategories = categories.filter(c =>
    type === 'receita'
      ? c.type === 'receita' || c.type === 'ambos'
      : c.type === 'despesa' || c.type === 'ambos'
  )

  const reset = () => {
    setDate(format(new Date(), 'yyyy-MM-dd'))
    setDescription('')
    setAmountFloat(0)
    setType('despesa')
    setCategoryId('')
    setBankId('')
    setStatus('realizado')
    setNotes('')
    setIsRecurring(false)
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return void toast.error('Digite uma descrição')
    if (amountFloat <= 0) return void toast.error('Informe um valor válido')
    if (!profile?.household_id) return

    setSaving(true)
    try {
      const { error } = await supabase.from('transactions').insert({
        household_id: profile.household_id,
        created_by: profile.id,
        date,
        description: description.trim(),
        amount: amountFloat,
        type,
        category_id: categoryId || null,
        bank_id: bankId || null,
        status,
        notes: notes.trim() || null,
        is_recurring: isRecurring,
      })
      if (error) throw error
      toast.success('Lançamento salvo! 🎉')
      onSuccess()
      handleClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Sheet */}
      <div className="relative w-full md:max-w-lg bg-white md:rounded-2xl rounded-t-3xl shadow-2xl animate-slide-up max-h-[92dvh] flex flex-col">
        {/* Handle bar (mobile only) */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Novo Lançamento</h2>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Form body */}
        <form
          id="tx-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-5"
        >
          {/* Tipo */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tipo</p>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all duration-150
                    ${type === t.value ? t.active : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Valor */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Valor</p>
            <NumericFormat
              onValueChange={v => setAmountFloat(v.floatValue || 0)}
              thousandSeparator="."
              decimalSeparator=","
              decimalScale={2}
              fixedDecimalScale
              prefix="R$ "
              placeholder="R$ 0,00"
              inputMode="decimal"
              className="input text-xl font-bold text-gray-900"
            />
          </div>

          {/* Descrição */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Descrição</p>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Supermercado, Salário..."
              className="input"
              autoComplete="off"
            />
          </div>

          {/* Data */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Data</p>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="input"
            />
          </div>

          {/* Categoria */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Categoria</p>
            {visibleCategories.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sem categorias para este tipo</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {visibleCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id === categoryId ? '' : cat.id)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all duration-150
                      ${categoryId === cat.id
                        ? 'border-primary-400 bg-primary-50'
                        : 'border-gray-100 hover:bg-gray-50'}`}
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-[10px] font-medium text-gray-600 text-center leading-tight w-full truncate">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Banco / Cartão */}
          {banks.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Banco / Cartão
              </p>
              <div className="grid grid-cols-2 gap-2">
                {banks.map(bank => (
                  <button
                    key={bank.id}
                    type="button"
                    onClick={() => setBankId(bank.id === bankId ? '' : bank.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all duration-150
                      ${bankId === bank.id
                        ? 'border-primary-400 bg-primary-50 text-primary-700'
                        : 'border-gray-100 text-gray-600 hover:bg-gray-50'}`}
                  >
                    <span className="flex-shrink-0">{bank.icon}</span>
                    <span className="truncate">{bank.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Status</p>
            <div className="flex gap-2">
              {STATUSES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl border-2 text-xs font-medium transition-all duration-150
                    ${status === s.value
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}
                >
                  <span className="text-base">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quem lançou */}
          {profile && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Lançado por
              </p>
              <div className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3.5 py-2.5">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: profile.avatar_color || '#6366F1' }}
                >
                  {profile.avatar_emoji || profile.name?.[0]}
                </div>
                <span className="text-sm font-medium text-gray-800">{profile.name}</span>
                <span className="text-xs text-gray-400 ml-auto">detectado automaticamente</span>
              </div>
            </div>
          )}

          {/* Observação */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Observação{' '}
              <span className="font-normal normal-case text-gray-400">(opcional)</span>
            </p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Alguma anotação extra..."
              rows={2}
              className="input resize-none"
            />
          </div>

          {/* Recorrente */}
          <label className="flex items-center gap-3 p-3.5 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={e => setIsRecurring(e.target.checked)}
              className="w-4 h-4 accent-primary-600 flex-shrink-0"
            />
            <div>
              <p className="text-sm font-medium text-gray-800">Lançamento recorrente 🔄</p>
              <p className="text-xs text-gray-400">Repete todo mês no mesmo dia</p>
            </div>
          </label>

          <div className="h-1" />
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            form="tx-form"
            type="submit"
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? 'Salvando...' : 'Salvar Lançamento 💾'}
          </button>
        </div>
      </div>
    </div>
  )
}
