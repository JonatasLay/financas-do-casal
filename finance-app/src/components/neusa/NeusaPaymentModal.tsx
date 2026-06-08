'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BankLogo } from '@/components/ui/BankLogo'
import { NumericFormat } from 'react-number-format'
import { X, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Bank } from '@/types'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  month: Date
  receivableNet: number
  cardTotal: number
  directTotal: number
  sharedTotal: number
  receivedSoFar: number
  pendingIds: string[]
  banks: Bank[]
  householdId: string
  userId: string
}

export function NeusaPaymentModal({
  open, onClose, onSuccess,
  month, receivableNet, cardTotal, directTotal, sharedTotal, receivedSoFar,
  pendingIds, banks, householdId, userId,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [amount, setAmount] = useState(receivableNet)
  const [bankId, setBankId] = useState('')
  const [saving, setSaving] = useState(false)

  const cashBanks = banks.filter(b => b.type !== 'credito')
  const monthLabel = format(month, 'MMMM/yyyy', { locale: ptBR })
  const grossTotal = cardTotal + directTotal + sharedTotal

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) return void toast.error('Informe um valor')
    if (!bankId) return void toast.error('Selecione a conta onde o dinheiro entrou')

    setSaving(true)
    try {
      const today = format(new Date(), 'yyyy-MM-dd')

      const { error: insertErr } = await supabase.from('transactions').insert({
        household_id: householdId,
        created_by: userId,
        date: today,
        settled_at: today,
        description: `Reembolso da Neuza - ${monthLabel}`,
        amount,
        type: 'receita',
        bank_id: bankId,
        status: 'realizado',
        is_neusa_reimbursement: true,
        responsible_party: 'casal',
        affects_household_cash: true,
        is_reimbursed: false,
        is_recurring: false,
        payment_method: 'transferencia',
        notes: `Quitacao das despesas de ${monthLabel}: cartao R$${cardTotal.toFixed(2)}, contas R$${directTotal.toFixed(2)}, coparticipacoes R$${sharedTotal.toFixed(2)}`,
      })
      if (insertErr) throw insertErr

      if (pendingIds.length > 0) {
        const { error: updateErr } = await supabase
          .from('transactions')
          .update({ is_reimbursed: true })
          .in('id', pendingIds)
        if (updateErr) throw updateErr
      }

      toast.success(`Reembolso de ${brl(amount)} registrado!`)
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-md rounded-t-3xl md:rounded-2xl animate-slide-up"
        style={{ background: 'rgba(13,13,26,0.99)', border: '1px solid rgba(244,114,182,0.3)' }}>

        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <h2 className="font-bold text-sm" style={{ color: '#F1F5F9' }}>Registrar pagamento da Neuza</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{monthLabel}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl" style={{ color: '#64748B' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

          {/* Breakdown */}
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(244,114,182,0.07)', border: '1px solid rgba(244,114,182,0.18)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#F9A8D4' }}>Composicao do mes</p>
            {cardTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: '#94A3B8' }}>Uso dela no cartao</span>
                <span className="font-semibold" style={{ color: '#F1F5F9' }}>{brl(cardTotal)}</span>
              </div>
            )}
            {directTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: '#94A3B8' }}>Contas pagas por voces</span>
                <span className="font-semibold" style={{ color: '#F1F5F9' }}>{brl(directTotal)}</span>
              </div>
            )}
            {sharedTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: '#94A3B8' }}>Coparticipacoes dela</span>
                <span className="font-semibold" style={{ color: '#F1F5F9' }}>{brl(sharedTotal)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ color: '#94A3B8' }}>Total bruto</span>
              <span className="font-bold" style={{ color: '#F9A8D4' }}>{brl(grossTotal)}</span>
            </div>
            {receivedSoFar > 0 && (
              <div className="flex justify-between text-sm">
                <span style={{ color: '#94A3B8' }}>Ja recebido</span>
                <span className="font-semibold" style={{ color: '#34D399' }}>- {brl(receivedSoFar)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-2" style={{ borderTop: '1px solid rgba(244,114,182,0.2)' }}>
              <span className="font-bold" style={{ color: '#F9A8D4' }}>A receber agora</span>
              <span className="font-bold text-base" style={{ color: '#FBBF24' }}>{brl(receivableNet)}</span>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>Valor recebido</p>
            <NumericFormat
              value={amount || ''}
              onValueChange={v => setAmount(v.floatValue || 0)}
              thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale
              prefix="R$ " placeholder="R$ 0,00" inputMode="decimal"
              className="input text-xl font-bold"
              style={{ color: '#F1F5F9' }}
            />
            {Math.abs(amount - receivableNet) > 0.01 && amount > 0 && (
              <p className="text-xs mt-1.5" style={{ color: '#FBBF24' }}>
                {amount > receivableNet
                  ? `Excedente de ${brl(amount - receivableNet)} em relacao ao calculado`
                  : `Faltam ${brl(receivableNet - amount)} para quitar tudo`}
              </p>
            )}
          </div>

          {/* Bank selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>Onde o dinheiro entrou</p>
            {cashBanks.length === 0 ? (
              <p className="text-sm" style={{ color: '#475569' }}>Nenhuma conta cadastrada</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {cashBanks.map(bank => (
                  <button key={bank.id} type="button"
                    onClick={() => setBankId(bank.id === bankId ? '' : bank.id)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all"
                    style={bankId === bank.id
                      ? { borderColor: '#F9A8D4', background: 'rgba(244,114,182,0.12)', color: '#F9A8D4' }
                      : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8' }}>
                    <BankLogo bank={bank} size="sm" />
                    <span className="truncate">{bank.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pending info */}
          {pendingIds.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#34D399' }} />
              <p className="text-xs" style={{ color: '#86EFAC' }}>
                {pendingIds.length} lancamento{pendingIds.length !== 1 ? 's' : ''} pendente{pendingIds.length !== 1 ? 's' : ''} sera{pendingIds.length !== 1 ? 'o' : ''} marcado{pendingIds.length !== 1 ? 's' : ''} como reembolsado.
              </p>
            </div>
          )}

          <button type="submit" disabled={saving || amount <= 0 || !bankId}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all"
            style={{ background: saving || amount <= 0 || !bankId ? 'rgba(244,114,182,0.2)' : 'rgba(244,114,182,0.85)', color: '#F9A8D4' }}>
            {saving ? 'Registrando...' : `Registrar ${brl(amount)}`}
          </button>
        </form>
      </div>
    </div>
  )
}
