'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BankLogo } from '@/components/ui/BankLogo'
import { NumericFormat } from 'react-number-format'
import { X, CreditCard, Info } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Bank } from '@/types'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  card: Bank
  invoiceAmount: number
  invoiceMonth: Date
  banks: Bank[]
  householdId: string
  userId: string
}

export function PayFaturaModal({
  open, onClose, onSuccess,
  card, invoiceAmount, invoiceMonth, banks, householdId, userId,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [amount, setAmount] = useState(invoiceAmount)
  const [bankId, setBankId] = useState('')
  const [payDate, setPayDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)

  const cashBanks = banks.filter(b => b.type !== 'credito')
  const monthLabel = format(invoiceMonth, 'MMMM/yyyy', { locale: ptBR })
  const cardColor = card.color || '#818CF8'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) return void toast.error('Informe o valor pago')
    if (!bankId) return void toast.error('Selecione a conta que pagou')

    setSaving(true)
    try {
      const { error } = await supabase.from('transactions').insert({
        household_id: householdId,
        created_by: userId,
        date: payDate,
        settled_at: payDate,
        description: `Pagamento fatura ${card.name} - ${monthLabel}`,
        amount,
        type: 'fatura',
        bank_id: bankId,
        target_bank_id: card.id,
        status: 'realizado',
        is_card_payment: true,
        affects_household_cash: true,
        is_recurring: false,
        payment_method: 'transferencia',
        responsible_party: 'casal',
        notes: `Pagamento da fatura ${card.name} referente a ${monthLabel}. Fatura total: ${brl(invoiceAmount)}.`,
      })
      if (error) throw error

      toast.success(`Pagamento de ${brl(amount)} registrado! Saldo atualizado.`)
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar pagamento')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full md:max-w-md rounded-t-3xl md:rounded-2xl animate-slide-up"
        style={{ background: 'rgba(13,13,26,0.99)', border: `1px solid ${cardColor}40` }}
      >
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${cardColor}20`, border: `1px solid ${cardColor}40` }}>
              <CreditCard className="w-4 h-4" style={{ color: cardColor }} />
            </div>
            <div>
              <h2 className="font-bold text-sm" style={{ color: '#F1F5F9' }}>Pagar fatura — {card.name}</h2>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{monthLabel} · fatura {brl(invoiceAmount)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl" style={{ color: '#64748B' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">

          {/* Valor */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>Valor pago</p>
            <NumericFormat
              value={amount || ''}
              onValueChange={v => setAmount(v.floatValue || 0)}
              thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale
              prefix="R$ " placeholder="R$ 0,00" inputMode="decimal"
              className="input text-xl font-bold"
              style={{ color: '#F1F5F9' }}
            />
            {Math.abs(amount - invoiceAmount) > 0.01 && amount > 0 && (
              <p className="text-xs mt-1.5" style={{ color: '#FBBF24' }}>
                {amount < invoiceAmount
                  ? `Pagamento parcial — falta ${brl(invoiceAmount - amount)} para quitar`
                  : `Excede a fatura em ${brl(amount - invoiceAmount)}`}
              </p>
            )}
          </div>

          {/* Data */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>Data do pagamento</p>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="input" />
          </div>

          {/* Conta */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#64748B' }}>Conta que pagou</p>
            {cashBanks.length === 0 ? (
              <p className="text-sm" style={{ color: '#475569' }}>Nenhuma conta corrente cadastrada</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {cashBanks.map(bank => (
                  <button key={bank.id} type="button"
                    onClick={() => setBankId(bank.id === bankId ? '' : bank.id)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all"
                    style={bankId === bank.id
                      ? { borderColor: cardColor, background: `${cardColor}15`, color: cardColor }
                      : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8' }}>
                    <BankLogo bank={bank} size="sm" />
                    <span className="truncate">{bank.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex items-start gap-2 rounded-xl px-3 py-2.5"
            style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.15)' }}>
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#818CF8' }} />
            <p className="text-xs" style={{ color: '#A5B4FC' }}>
              O saldo da conta selecionada sera debitado automaticamente. As despesas do cartao ja estao contabilizadas — este lancamento nao gera nova despesa no relatorio.
            </p>
          </div>

          <button type="submit" disabled={saving || amount <= 0 || !bankId}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all"
            style={{
              background: saving || amount <= 0 || !bankId ? `${cardColor}25` : `${cardColor}cc`,
              color: cardColor,
            }}>
            {saving ? 'Registrando...' : `Registrar pagamento de ${brl(amount)}`}
          </button>
        </form>
      </div>
    </div>
  )
}
