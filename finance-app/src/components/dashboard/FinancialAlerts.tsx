'use client'

import Link from 'next/link'
import { AlertTriangle, BellRing, CalendarClock, ChevronRight, ReceiptText, WalletCards } from 'lucide-react'
import type { Budget, Transaction } from '@/types'

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

interface FinancialAlertsProps {
  projectedBalance: number
  cashBalance: number
  neusaReceivable: number
  budgets: Budget[]
  transactions: Transaction[]
  creditInvoiceTotal: number
  selectedMonth: Date
  loading: boolean
}

export function FinancialAlerts({
  projectedBalance,
  cashBalance,
  neusaReceivable,
  budgets,
  transactions,
  creditInvoiceTotal,
  selectedMonth,
  loading,
}: FinancialAlertsProps) {
  if (loading) return <div className="skeleton h-28 rounded-2xl" />

  const spentByCategory: Record<string, number> = {}
  for (const tx of transactions) {
    if (tx.type === 'receita' || !tx.category_id) continue
    spentByCategory[tx.category_id] = (spentByCategory[tx.category_id] || 0) + Number(tx.amount)
  }

  const budgetAlerts = budgets
    .map(budget => {
      const limit = Number(budget.amount)
      const spent = spentByCategory[budget.category_id] || 0
      const pct = limit > 0 ? spent / limit : 0
      return { budget, spent, limit, pct }
    })
    .filter(item => item.limit > 0 && item.pct >= 0.8)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 2)

  const alerts: {
    key: string
    title: string
    detail: string
    tone: 'danger' | 'warning' | 'info' | 'success'
    icon: React.ReactNode
    href?: string
  }[] = []

  if (projectedBalance < 0) {
    alerts.push({
      key: 'negative-balance',
      title: 'Saldo previsto negativo',
      detail: `O mês está projetando ${brl(projectedBalance)}. Priorize cortar gastos variáveis e confirmar receitas.`,
      tone: 'danger',
      icon: <AlertTriangle className="w-4 h-4" />,
    })
  } else if (projectedBalance > 0) {
    alerts.push({
      key: 'positive-balance',
      title: 'Sobra prevista no mês',
      detail: `Se tudo se confirmar, sobram ${brl(projectedBalance)}. Separe uma parte antes de gastar.`,
      tone: 'success',
      icon: <WalletCards className="w-4 h-4" />,
    })
  }

  if (cashBalance < Math.max(creditInvoiceTotal, 0)) {
    alerts.push({
      key: 'cash-pressure',
      title: 'Atenção ao caixa atual',
      detail: `Contas somam ${brl(cashBalance)} e faturas previstas somam ${brl(creditInvoiceTotal)}.`,
      tone: 'warning',
      icon: <CalendarClock className="w-4 h-4" />,
    })
  }

  if (neusaReceivable > 0) {
    const month = selectedMonth.getMonth() + 1
    const year = selectedMonth.getFullYear()
    alerts.push({
      key: 'neusa',
      title: 'Reembolso da Neusa pendente',
      detail: `${brl(neusaReceivable)} ainda precisa ser reembolsado. Gere o relatório para enviar.`,
      tone: 'info',
      icon: <ReceiptText className="w-4 h-4" />,
      href: `/reports/neusa?month=${month}&year=${year}`,
    })
  }

  for (const item of budgetAlerts) {
    const over = item.pct >= 1
    alerts.push({
      key: `budget-${item.budget.id}`,
      title: over ? `Orçamento estourado: ${item.budget.category?.name || 'Categoria'}` : `Orçamento em alerta: ${item.budget.category?.name || 'Categoria'}`,
      detail: `${brl(item.spent)} usados de ${brl(item.limit)} (${Math.round(item.pct * 100)}%).`,
      tone: over ? 'danger' : 'warning',
      icon: <AlertTriangle className="w-4 h-4" />,
      href: '/settings',
    })
  }

  if (alerts.length === 0) return null

  const toneStyle = {
    danger: { color: '#F87171', bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.22)' },
    warning: { color: '#FBBF24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.22)' },
    info: { color: '#22D3EE', bg: 'rgba(34,211,238,0.10)', border: 'rgba(34,211,238,0.22)' },
    success: { color: '#34D399', bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.22)' },
  }

  return (
    <section className="rounded-2xl p-4 space-y-3"
      style={{ background: 'rgba(17,17,36,0.68)', border: '1px solid rgba(129,140,248,0.16)' }}>
      <div className="flex items-center gap-2">
        <BellRing className="w-4 h-4" style={{ color: '#A5B4FC' }} />
        <h2 className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Alertas automáticos</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {alerts.map(alert => {
          const style = toneStyle[alert.tone]
          const content = (
            <div className="rounded-xl p-3 flex items-start gap-3 h-full"
              style={{ background: style.bg, border: `1px solid ${style.border}` }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(0,0,0,0.14)', color: style.color }}>
                {alert.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>{alert.title}</p>
                <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#94A3B8' }}>{alert.detail}</p>
              </div>
              {alert.href && <ChevronRight className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: '#64748B' }} />}
            </div>
          )

          return alert.href
            ? <Link key={alert.key} href={alert.href}>{content}</Link>
            : <div key={alert.key}>{content}</div>
        })}
      </div>
    </section>
  )
}
