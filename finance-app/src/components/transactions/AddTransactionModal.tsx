'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { X } from 'lucide-react'
import { NumericFormat } from 'react-number-format'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { Category, Bank, Transaction, TransactionType, TransactionStatus } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  editTransaction?: Transaction | null
}

const TYPES: { value: TransactionType; label: string; activeBg: string; activeBorder: string; activeText: string }[] = [
  { value: 'despesa',       label: '💸 Despesa',   activeBg: 'rgba(248,113,113,0.15)', activeBorder: '#F87171', activeText: '#F87171' },
  { value: 'receita',       label: '💰 Receita',   activeBg: 'rgba(52,211,153,0.15)',  activeBorder: '#34D399', activeText: '#34D399' },
  { value: 'fatura',        label: '💳 Fatura',    activeBg: 'rgba(251,146,60,0.15)',  activeBorder: '#FB923C', activeText: '#FB923C' },
  { value: 'transferencia', label: '🔄 Transfer.', activeBg: 'rgba(34,211,238,0.15)',  activeBorder: '#22D3EE', activeText: '#22D3EE' },
]

const STATUSES: { value: TransactionStatus; label: string; icon: string }[] = [
  { value: 'realizado', label: 'Realizado', icon: '✅' },
  { value: 'pendente',  label: 'Pendente',  icon: '⏳' },
  { value: 'agendado',  label: 'Agendado',  icon: '📅' },
]

export function AddTransactionModal({ open, onClose, onSuccess, editTransaction }: Props) {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [saving, setSaving] = useState(false)

  const isEdit = !!editTransaction

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

  // Pre-fill fields when editing
  useEffect(() => {
    if (editTransaction) {
      setDate(editTransaction.date)
      setDescription(editTransaction.description)
      setAmountFloat(Number(editTransaction.amount))
      setType(editTransaction.type)
      setCategoryId(editTransaction.category_id || '')
      setBankId(editTransaction.bank_id || '')
      setStatus(editTransaction.status as TransactionStatus)
      setNotes(editTransaction.notes || '')
      setIsRecurring(editTransaction.is_recurring || false)
    } else {
      reset()
    }
  }, [editTransaction, open])

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

  const handleClose = () => { if (!isEdit) reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return void toast.error('Digite uma descrição')
    if (amountFloat <= 0) return void toast.error('Informe um valor válido')
    if (!profile?.household_id) return

    setSaving(true)
    try {
      const payload = {
        date,
        description: description.trim(),
        amount: amountFloat,
        type,
        category_id: categoryId || null,
        bank_id: bankId || null,
        status,
        notes: notes.trim() || null,
        is_recurring: isRecurring,
      }

      if (isEdit && editTransaction) {
        const { error } = await supabase.from('transactions').update(payload).eq('id', editTransaction.id)
        if (error) throw error
        toast.success('Lançamento atualizado! ✏️')
      } else {
        const { error } = await supabase.from('transactions').insert({
          ...payload,
          household_id: profile.household_id,
          created_by: profile.id,
        })
        if (error) throw error
        toast.success('Lançamento salvo! 🎉')
      }

      onSuccess()
      handleClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const cardBg   = 'rgba(17,17,36,0.98)'
  const borderC  = 'rgba(129,140,248,0.2)'
  const inputBg  = 'rgba(255,255,255,0.05)'
  const labelC   = '#64748B'
  const textC    = '#F1F5F9'

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative w-full md:max-w-lg md:rounded-2xl rounded-t-3xl shadow-2xl animate-slide-up max-h-[92dvh] flex flex-col"
        style={{ background: cardBg, border: `1px solid ${borderC}` }}>

        {/* Handle bar mobile */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${borderC}` }}>
          <h2 className="font-bold" style={{ color: textC }}>
            {isEdit ? '✏️ Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <button onClick={handleClose} className="p-1.5 rounded-xl transition-colors"
            style={{ color: '#64748B' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form body */}
        <form id="tx-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Tipo */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Tipo</p>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map(t => {
                const active = type === t.value
                return (
                  <button key={t.value} type="button" onClick={() => setType(t.value)}
                    className="py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all duration-150"
                    style={active
                      ? { background: t.activeBg, borderColor: t.activeBorder, color: t.activeText }
                      : { background: inputBg, borderColor: 'rgba(255,255,255,0.08)', color: '#94A3B8' }}>
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Valor */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Valor</p>
            <NumericFormat
              value={amountFloat || ''}
              onValueChange={v => setAmountFloat(v.floatValue || 0)}
              thousandSeparator="."
              decimalSeparator=","
              decimalScale={2}
              fixedDecimalScale
              prefix="R$ "
              placeholder="R$ 0,00"
              inputMode="decimal"
              className="input text-xl font-bold"
              style={{ color: textC }}
            />
          </div>

          {/* Descrição */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Descrição</p>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Supermercado, Salário..." className="input" autoComplete="off" />
          </div>

          {/* Data */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Data</p>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
          </div>

          {/* Categoria */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Categoria</p>
            {visibleCategories.length === 0 ? (
              <p className="text-sm italic" style={{ color: '#475569' }}>Sem categorias para este tipo</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {visibleCategories.map(cat => (
                  <button key={cat.id} type="button"
                    onClick={() => setCategoryId(cat.id === categoryId ? '' : cat.id)}
                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all duration-150"
                    style={categoryId === cat.id
                      ? { borderColor: '#818CF8', background: 'rgba(129,140,248,0.12)' }
                      : { borderColor: 'rgba(255,255,255,0.07)', background: inputBg }}>
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="text-[10px] font-medium text-center leading-tight w-full truncate"
                      style={{ color: categoryId === cat.id ? '#818CF8' : '#94A3B8' }}>
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
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Banco / Cartão</p>
              <div className="grid grid-cols-2 gap-2">
                {banks.map(bank => (
                  <button key={bank.id} type="button"
                    onClick={() => setBankId(bank.id === bankId ? '' : bank.id)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all duration-150"
                    style={bankId === bank.id
                      ? { borderColor: '#818CF8', background: 'rgba(129,140,248,0.12)', color: '#818CF8' }
                      : { borderColor: 'rgba(255,255,255,0.07)', background: inputBg, color: '#94A3B8' }}>
                    <span className="flex-shrink-0">{bank.icon}</span>
                    <span className="truncate">{bank.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Status</p>
            <div className="flex gap-2">
              {STATUSES.map(s => (
                <button key={s.value} type="button" onClick={() => setStatus(s.value)}
                  className="flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl border-2 text-xs font-medium transition-all duration-150"
                  style={status === s.value
                    ? { borderColor: '#818CF8', background: 'rgba(129,140,248,0.12)', color: '#818CF8' }
                    : { borderColor: 'rgba(255,255,255,0.07)', background: inputBg, color: '#94A3B8' }}>
                  <span className="text-base">{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quem lançou */}
          {profile && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>Lançado por</p>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                style={{ background: inputBg, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: profile.avatar_color || '#6366F1' }}>
                  {profile.avatar_emoji || profile.name?.[0]}
                </div>
                <span className="text-sm font-medium" style={{ color: textC }}>{profile.name}</span>
                <span className="text-xs ml-auto" style={{ color: '#475569' }}>detectado automaticamente</span>
              </div>
            </div>
          )}

          {/* Observação */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: labelC }}>
              Observação <span className="font-normal normal-case" style={{ color: '#334155' }}>(opcional)</span>
            </p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Alguma anotação extra..." rows={2} className="input resize-none" />
          </div>

          {/* Recorrente */}
          <label className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-colors"
            style={{ background: inputBg, border: '1px solid rgba(255,255,255,0.06)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = inputBg)}>
            <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
              className="w-4 h-4 accent-indigo-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium" style={{ color: textC }}>Lançamento recorrente 🔄</p>
              <p className="text-xs" style={{ color: '#475569' }}>Repete todo mês no mesmo dia</p>
            </div>
          </label>

          <div className="h-1" />
        </form>

        {/* Footer */}
        <div className="px-5 py-4" style={{ borderTop: `1px solid ${borderC}` }}>
          <button form="tx-form" type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Salvando...' : isEdit ? 'Salvar Alterações ✏️' : 'Salvar Lançamento 💾'}
          </button>
        </div>
      </div>
    </div>
  )
}
