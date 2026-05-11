'use client'

import { CalendarClock, CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { BankLogo } from '@/components/ui/BankLogo'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Bank, Transaction } from '@/types'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'

interface Props {
  targetMonth: Date
  transactions: Transaction[]
  creditTransactions: Transaction[]
  banks: Bank[]
  loading?: boolean
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const isCoupleExpense = (tx: Transaction) => (tx.responsible_party || 'casal') === 'casal'
const isNeusaExpense = (tx: Transaction) => tx.responsible_party === 'sogra'

export function FuturePreview({ targetMonth, transactions, creditTransactions, banks, loading }: Props) {
  const creditCards = banks.filter(bank => bank.type === 'credito')
  const bankById = new Map(banks.map(bank => [bank.id, bank]))

  const income = transactions
    .filter(tx => tx.type === 'receita')
    .reduce((sum, tx) => sum + Number(tx.amount), 0)

  const directTransactions = transactions
    .filter(tx => tx.type !== 'receita' && bankById.get(tx.bank_id || '')?.type !== 'credito')

  const directExpenses = directTransactions
    .reduce((sum, tx) => sum + Number(tx.amount), 0)

  const directCoupleExpenses = directTransactions
    .filter(isCoupleExpense)
    .reduce((sum, tx) => sum + Number(tx.amount), 0)

  const directNeusaPending = directTransactions
    .filter(tx => isNeusaExpense(tx) && !tx.is_reimbursed)
    .reduce((sum, tx) => sum + Number(tx.amount), 0)

  const cardBills = creditCards.map(card => ({
    card,
    transactions: creditTransactions
      .filter(tx => {
        if (tx.bank_id !== card.id || tx.type === 'receita' || tx.status !== 'realizado') return false
        return isDateInMonth(getCreditCardPaymentDate(tx.date, card.due_day), targetMonth)
      }),
  }))
    .map(item => ({
      ...item,
      total: item.transactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
      couple: item.transactions.filter(isCoupleExpense).reduce((sum, tx) => sum + Number(tx.amount), 0),
      neusa: item.transactions.filter(isNeusaExpense).reduce((sum, tx) => sum + Number(tx.amount), 0),
      neusaPending: item.transactions
        .filter(tx => isNeusaExpense(tx) && !tx.is_reimbursed)
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
    }))
    .filter(item => item.total > 0)

  const creditTotal = cardBills.reduce((sum, item) => sum + item.total, 0)
  const creditCoupleTotal = cardBills.reduce((sum, item) => sum + item.couple, 0)
  const neusaTotal = cardBills.reduce((sum, item) => sum + item.neusa, 0) + directTransactions.filter(isNeusaExpense).reduce((sum, tx) => sum + Number(tx.amount), 0)
  const neusaPending = cardBills.reduce((sum, item) => sum + item.neusaPending, 0) + directNeusaPending
  const coupleOutflow = directCoupleExpenses + creditCoupleTotal
  const projectedBalance = income - coupleOutflow - neusaPending
  const monthLabel = format(targetMonth, 'MMMM yyyy', { locale: ptBR })

  if (loading) return <div className="skeleton h-40 rounded-2xl" />

  if (income === 0 && directExpenses === 0 && creditTotal === 0) {
    return (
      <div className="card" style={{ border: '1px solid rgba(34,211,238,0.14)' }}>
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4" style={{ color: '#22D3EE' }} />
          <p className="font-semibold text-sm capitalize" style={{ color: '#F1F5F9' }}>Prévia de {monthLabel}</p>
        </div>
        <p className="text-sm mt-3" style={{ color: '#64748B' }}>
          Nenhum lançamento futuro ou fatura prevista para este mês.
        </p>
      </div>
    )
  }

  return (
    <div className="card space-y-4" style={{ border: '1px solid rgba(34,211,238,0.14)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4" style={{ color: '#22D3EE' }} />
          <p className="font-semibold text-sm capitalize" style={{ color: '#F1F5F9' }}>Prévia de {monthLabel}</p>
        </div>
        <p className="text-sm font-bold font-mono-nums" style={{ color: projectedBalance >= 0 ? '#34D399' : '#F87171' }}>
          {projectedBalance >= 0 ? '+' : ''}{brl(projectedBalance)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl p-3" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)' }}>
          <ArrowUpRight className="w-4 h-4 mb-2" style={{ color: '#34D399' }} />
          <p className="text-[10px] uppercase tracking-wide" style={{ color: '#64748B' }}>Receber</p>
          <p className="text-sm font-bold font-mono-nums" style={{ color: '#F1F5F9' }}>{brl(income)}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)' }}>
          <ArrowDownRight className="w-4 h-4 mb-2" style={{ color: '#F87171' }} />
          <p className="text-[10px] uppercase tracking-wide" style={{ color: '#64748B' }}>Casal</p>
          <p className="text-sm font-bold font-mono-nums" style={{ color: '#F1F5F9' }}>{brl(coupleOutflow)}</p>
        </div>
        <div className="rounded-xl p-3" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.18)' }}>
          <CreditCard className="w-4 h-4 mb-2" style={{ color: '#FB923C' }} />
          <p className="text-[10px] uppercase tracking-wide" style={{ color: '#64748B' }}>Fatura real</p>
          <p className="text-sm font-bold font-mono-nums" style={{ color: '#F1F5F9' }}>{brl(creditTotal)}</p>
        </div>
      </div>

      {(neusaTotal > 0 || neusaPending > 0) && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-3" style={{ background: 'rgba(244,114,182,0.08)', border: '1px solid rgba(244,114,182,0.18)' }}>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: '#64748B' }}>Neusa no mes</p>
            <p className="text-sm font-bold font-mono-nums" style={{ color: '#F9A8D4' }}>{brl(neusaTotal)}</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.18)' }}>
            <p className="text-[10px] uppercase tracking-wide" style={{ color: '#64748B' }}>A receber dela</p>
            <p className="text-sm font-bold font-mono-nums" style={{ color: neusaPending > 0 ? '#FB923C' : '#94A3B8' }}>{brl(neusaPending)}</p>
          </div>
        </div>
      )}

      {cardBills.length > 0 && (
        <div className="space-y-2">
          {cardBills.map(({ card, total, couple, neusa, neusaPending }) => (
            <div key={card.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2"
              style={{ background: `${card.color || '#818CF8'}0D`, border: `1px solid ${card.color || '#818CF8'}22` }}>
              <div className="flex items-center gap-2 min-w-0">
                <BankLogo bank={card} size="xs" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: '#F1F5F9' }}>{card.name}</p>
                  <p className="text-[10px]" style={{ color: '#64748B' }}>
                    Casal {brl(couple)} | Neusa {brl(neusa)}{neusaPending > 0 ? ` | a receber ${brl(neusaPending)}` : ''}
                  </p>
                </div>
                {card.due_day && <span className="text-[10px] flex-shrink-0" style={{ color: '#64748B' }}>dia {card.due_day}</span>}
              </div>
              <p className="text-xs font-bold font-mono-nums" style={{ color: '#FB923C' }}>{brl(total)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
