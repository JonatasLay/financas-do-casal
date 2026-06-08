'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { ExpenseChart } from '@/components/dashboard/ExpenseChart'
import { CategoryChart } from '@/components/dashboard/CategoryChart'
import { GoalsMini } from '@/components/dashboard/GoalsMini'
import { DailyTip } from '@/components/dashboard/DailyTip'
import { OnlineIndicator } from '@/components/dashboard/OnlineIndicator'
import { BudgetsMini } from '@/components/dashboard/BudgetsMini'
import { CreditCardSummary } from '@/components/dashboard/CreditCardSummary'
import { FuturePreview } from '@/components/dashboard/FuturePreview'
import { DollarRate } from '@/components/dashboard/DollarRate'
import { FinancialAlerts } from '@/components/dashboard/FinancialAlerts'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { BankLogo } from '@/components/ui/BankLogo'
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'
import {
  calculateAccumulatedCashForecast,
  calculateMonthProjection,
  getEffectiveCashDate,
  getHouseholdNetAmount,
  getNeusaShareAmount,
  isCoupleTransaction,
  isNeusaReimbursement,
  isNeusaTransaction,
} from '@/lib/finance-summary'
import { RefreshCw, TrendingUp, PiggyBank, Wallet, ArrowUpRight, ArrowDownRight, X, Landmark } from 'lucide-react'
import type { Transaction, Goal, Category, Budget, Bank } from '@/types'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
})

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type DetailKind = 'income' | 'expenses' | 'balance' | 'planned' | 'neusa' | 'future-income' | 'future-couple' | 'future-expenses' | 'future-card'

function DetailModal({ open, title, subtitle, transactions, totalOverride, breakdownByBank = false, amountResolver, onClose }: {
  open: boolean
  title: string
  subtitle?: string
  transactions: Transaction[]
  totalOverride?: number
  breakdownByBank?: boolean
  amountResolver?: (tx: Transaction) => number
  onClose: () => void
}) {
  if (!open) return null
  const resolveAmount = amountResolver || ((tx: Transaction) => Number(tx.amount))
  const total = totalOverride ?? transactions.reduce((sum, tx) => sum + (tx.type === 'receita' ? resolveAmount(tx) : -resolveAmount(tx)), 0)
  const bankSubtotals = Array.from(transactions.reduce((groups, tx) => {
    const name = tx.bank?.name || 'Sem banco informado'
    groups.set(name, (groups.get(name) || 0) + resolveAmount(tx))
    return groups
  }, new Map<string, number>()))

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full md:max-w-2xl max-h-[82dvh] rounded-t-3xl md:rounded-2xl overflow-hidden"
        style={{ background: 'rgba(13,13,26,0.92)', border: '1px solid rgba(129,140,248,0.25)', boxShadow: '0 24px 80px rgba(0,0,0,0.45)' }}>
        <div className="flex items-start justify-between gap-4 p-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <p className="text-sm font-bold" style={{ color: '#F1F5F9' }}>{title}</p>
            {subtitle && <p className="text-xs mt-1" style={{ color: '#64748B' }}>{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold font-mono-nums" style={{ color: '#C7D2FE' }}>{brl(total)}</p>
            <button onClick={onClose} className="p-1.5 rounded-xl" style={{ color: '#64748B' }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto max-h-[64dvh]">
          {breakdownByBank && bankSubtotals.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {bankSubtotals.map(([name, subtotal]) => (
                <div key={name} className="rounded-xl px-3 py-2 flex items-center justify-between gap-3"
                  style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.16)' }}>
                  <p className="text-xs font-medium" style={{ color: '#CBD5E1' }}>{name}</p>
                  <p className="text-xs font-bold font-mono-nums" style={{ color: '#FB923C' }}>{brl(subtotal)}</p>
                </div>
              ))}
            </div>
          )}
          {transactions.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#64748B' }}>Nenhum lançamento neste grupo.</p>
          ) : transactions.map(tx => {
            const displayAmount = resolveAmount(tx)
            const neusaShare = getNeusaShareAmount(tx)
            const hasNetAdjustment = tx.type !== 'receita' && tx.responsible_party !== 'sogra' && neusaShare > 0 && displayAmount !== Number(tx.amount)

            return (
              <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#F1F5F9' }}>{tx.description}</p>
                  <p className="text-[11px]" style={{ color: '#64748B' }}>
                    {format(new Date(`${tx.date}T12:00:00`), 'dd/MM/yyyy')} · {tx.status}
                    {tx.bank?.name ? ` · ${tx.bank.name}` : ''}
                    {tx.responsible_party === 'sogra' ? ' · Neusa' : ''}
                    {tx.type === 'receita' && tx.is_neusa_reimbursement ? ' · Reembolso da Neuza' : ''}
                  </p>
                  {hasNetAdjustment && (
                    <p className="text-[11px] mt-1" style={{ color: '#FB923C' }}>
                      Bruto {brl(Number(tx.amount))} · Parte da Neuza {brl(neusaShare)} · LÃ­quido casal {brl(displayAmount)}
                    </p>
                  )}
                </div>
                <p className="text-sm font-bold font-mono-nums flex-shrink-0" style={{ color: tx.type === 'receita' ? '#34D399' : '#F87171' }}>
                  {tx.type === 'receita' ? '+' : '-'}{brl(displayAmount)}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

// â”€â”€â”€ Patrimônio Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PatrimonyCard({ householdId, loading: parentLoading }: { householdId: string; loading: boolean }) {
  const supabase = createClient()
  const [savings, setSavings]     = useState(0)
  const [investments, setInvestments] = useState(0)
  const [loaded, setLoaded]       = useState(false)

  useEffect(() => {
    if (!householdId) return
    Promise.all([
      supabase.from('savings').select('current_amount').eq('household_id', householdId),
      supabase.from('investments').select('quantity, current_price').eq('household_id', householdId),
    ]).then(([sRes, iRes]) => {
      setSavings((sRes.data || []).reduce((s, x) => s + Number(x.current_amount), 0))
      setInvestments((iRes.data || []).reduce((s, x) => s + Number(x.quantity) * Number(x.current_price), 0))
      setLoaded(true)
    })
  }, [householdId])

  const total = savings + investments
  const loading = parentLoading || !loaded

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'Poupança',      value: savings,     color: '#34D399', icon: <PiggyBank className="w-4 h-4" /> },
        { label: 'Investimentos', value: investments, color: '#FBBF24', icon: <TrendingUp className="w-4 h-4" /> },
        { label: 'Patrimônio',   value: total,       color: '#818CF8', icon: <Wallet className="w-4 h-4" /> },
      ].map(({ label, value, color, icon }) => (
        <div key={label} className="rounded-2xl p-3.5 flex flex-col gap-2"
          style={{ background: `${color}0D`, border: `1px solid ${color}25` }}>
          <div className="flex items-center gap-1.5" style={{ color }}>
            {icon}
            <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
          </div>
          {loading
            ? <div className="skeleton h-5 rounded w-20" />
            : <p className="text-base font-bold font-mono-nums leading-tight" style={{ color: '#F1F5F9' }}>{brl(value)}</p>
          }
        </div>
      ))}
    </div>
  )
}

// â”€â”€â”€ Quick Stats Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QuickStats({ income, expenses, balance, prevBalance, loading }: {
  income: number; expenses: number; balance: number; prevBalance: number; loading: boolean
}) {
  const balanceDelta = prevBalance !== 0 ? ((balance - prevBalance) / Math.abs(prevBalance)) * 100 : 0
  const positive = balance >= 0
  const deltaPositive = balanceDelta >= 0

  return (
    <div className="rounded-2xl p-4 space-y-3"
      style={{ background: 'linear-gradient(135deg, rgba(129,140,248,0.08), rgba(244,114,182,0.05))', border: '1px solid rgba(129,140,248,0.18)' }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>Saldo do mês</p>
        {!loading && prevBalance !== 0 && (
          <div className="flex items-center gap-1">
            {deltaPositive ? <ArrowUpRight className="w-3.5 h-3.5" style={{ color: '#34D399' }} /> : <ArrowDownRight className="w-3.5 h-3.5" style={{ color: '#F87171' }} />}
            <span className="text-xs font-bold" style={{ color: deltaPositive ? '#34D399' : '#F87171' }}>
              {deltaPositive ? '+' : ''}{balanceDelta.toFixed(1)}% vs mês ant.
            </span>
          </div>
        )}
      </div>

      {loading
        ? <div className="skeleton h-8 rounded w-40" />
        : <p className="text-3xl font-bold font-mono-nums" style={{ color: positive ? '#34D399' : '#F87171' }}>
            {brl(balance)}
          </p>
      }

      <div className="grid grid-cols-2 gap-3 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#64748B' }}>Receitas</p>
          {loading
            ? <div className="skeleton h-5 rounded w-24" />
            : <p className="text-sm font-bold font-mono-nums" style={{ color: '#34D399' }}>+{brl(income)}</p>
          }
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#64748B' }}>Despesas</p>
          {loading
            ? <div className="skeleton h-5 rounded w-24" />
            : <p className="text-sm font-bold font-mono-nums" style={{ color: '#F87171' }}>-{brl(expenses)}</p>
          }
        </div>
      </div>
    </div>
  )
}

function MonthlyCommandCenter({ income, plannedIncome, reimbursementIncome, expenses, plannedCashExpenses, plannedCreditInvoices, balance, projectedBalance, cashBalance, projectedCashBalance, prevBalance, neusaTotal, neusaReceivable, neusaDirectTotal, historical, loading, onOpen }: {
  income: number; plannedIncome: number; reimbursementIncome: number; expenses: number; plannedCashExpenses: number; plannedCreditInvoices: number
  balance: number; projectedBalance: number; cashBalance: number; projectedCashBalance: number; prevBalance: number
  neusaTotal: number; neusaReceivable: number; neusaDirectTotal: number; historical: boolean; loading: boolean; onOpen: (kind: DetailKind) => void
}) {
  const balanceDelta = prevBalance !== 0 ? ((projectedBalance - prevBalance) / Math.abs(prevBalance)) * 100 : 0
  const deltaPositive = balanceDelta >= 0
  const totalIncome = income + plannedIncome
  const directExpenses = expenses + plannedCashExpenses
  const displayedBalance = historical ? projectedBalance : projectedCashBalance
  const cards = [
    { kind: 'income' as const, label: 'Receitas do casal', value: totalIncome, detail: `${brl(income)} recebido · ${brl(plannedIncome)} previsto`, color: '#34D399' },
    { kind: 'expenses' as const, label: 'Despesas lÃ­quidas', value: directExpenses, detail: `${brl(expenses)} pago · ${brl(plannedCashExpenses)} previsto`, color: '#F87171' },
    { kind: 'planned' as const, label: 'Fatura lÃ­quida', value: plannedCreditInvoices, detail: 'descontando parte da Neuza', color: '#FBBF24' },
    { kind: 'balance' as const, label: historical ? 'Resultado do mês' : 'Caixa acumulado', value: displayedBalance, detail: historical ? 'receitas menos despesas e faturas' : `contas hoje ${brl(cashBalance)} | mês ${projectedBalance >= 0 ? '+' : ''}${brl(projectedBalance)}`, color: displayedBalance >= 0 ? '#818CF8' : '#F87171' },
    { kind: 'neusa' as const, label: 'Neuza', value: neusaReceivable, detail: `${brl(neusaTotal)} no mês · ${brl(reimbursementIncome)} reembolsado`, color: '#F9A8D4' },
  ]

  if (loading) return <div className="skeleton h-48 rounded-2xl" />

  return (
    <div className="rounded-2xl p-4 space-y-4"
      style={{ background: 'linear-gradient(135deg, rgba(129,140,248,0.08), rgba(244,114,182,0.05))', border: '1px solid rgba(129,140,248,0.18)' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>{historical ? 'Resultado consolidado do mês' : 'Caixa previsto no fim do mês'}</p>
          <p className="text-[11px] mt-0.5" style={{ color: '#64748B' }}>{historical ? 'Receitas menos despesas diretas e faturas do perÃ­odo' : 'Saldo atual das contas + fluxo acumulado até o mês selecionado'}</p>
        </div>
        {prevBalance !== 0 && (
          <div className="flex items-center gap-1">
            {deltaPositive ? <ArrowUpRight className="w-3.5 h-3.5" style={{ color: '#34D399' }} /> : <ArrowDownRight className="w-3.5 h-3.5" style={{ color: '#F87171' }} />}
            <span className="text-xs font-bold" style={{ color: deltaPositive ? '#34D399' : '#F87171' }}>
              {deltaPositive ? '+' : ''}{balanceDelta.toFixed(1)}% vs mes ant.
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <p className="text-4xl font-bold font-mono-nums" style={{ color: displayedBalance >= 0 ? '#34D399' : '#F87171' }}>
          {displayedBalance >= 0 ? '+' : ''}{brl(displayedBalance)}
        </p>
        <p className="text-xs pb-1" style={{ color: '#64748B' }}>
          resultado do mês: <span className="font-bold" style={{ color: projectedBalance >= 0 ? '#34D399' : '#F87171' }}>{projectedBalance >= 0 ? '+' : ''}{brl(projectedBalance)}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {cards.map(card => (
          <button key={card.kind} type="button" onClick={() => onOpen(card.kind)}
            className="rounded-xl p-3 text-left transition-transform active:scale-[0.99]"
            style={{ background: `${card.color}10`, border: `1px solid ${card.color}30` }}>
            <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: card.color }}>{card.label}</p>
            <p className="text-base font-bold font-mono-nums mt-1" style={{ color: '#F1F5F9' }}>{brl(card.value)}</p>
            <p className="text-[10px] mt-1 leading-tight" style={{ color: '#64748B' }}>{card.detail}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function AccountBalancesCard({ banks, loading }: { banks: Bank[]; loading: boolean }) {
  const cashBanks = banks.filter(bank => bank.type !== 'credito')
  const total = cashBanks.reduce((sum, bank) => sum + Number(bank.current_balance || 0), 0)

  if (loading) return <div className="skeleton h-24 rounded-2xl" />
  if (cashBanks.length === 0) return null

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.18)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4" style={{ color: '#22D3EE' }} />
          <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Saldo atual das contas</p>
        </div>
        <p className="text-sm font-bold font-mono-nums" style={{ color: total >= 0 ? '#34D399' : '#F87171' }}>{brl(total)}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {cashBanks.map(bank => (
          <div key={bank.id} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-2 min-w-0">
              <BankLogo bank={bank} size="xs" />
              <p className="text-[10px] uppercase tracking-wide truncate" style={{ color: '#64748B' }}>{bank.name}</p>
            </div>
            <p className="text-sm font-bold font-mono-nums mt-0.5" style={{ color: '#F1F5F9' }}>{brl(Number(bank.current_balance || 0))}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function DashboardPage() {
  const supabase = createClient()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [nextMonthTransactions, setNextMonthTransactions] = useState<Transaction[]>([])
  const [creditInvoiceTransactions, setCreditInvoiceTransactions] = useState<Transaction[]>([])
  const [forecastTransactions, setForecastTransactions] = useState<Transaction[]>([])
  const [goals, setGoals]       = useState<Goal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets]   = useState<Budget[]>([])
  const [banks, setBanks]       = useState<Bank[]>([])
  const [monthlyHistory, setMonthlyHistory] = useState<{ month: string; income: number; expenses: number }[]>([])
  const [profile, setProfile]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [prevBalance, setPrevBalance] = useState(0)
  const [detailKind, setDetailKind] = useState<DetailKind | null>(null)

  // Pull-to-refresh
  const [pullY, setPullY]       = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const isAtTop     = useRef(false)
  const PULL_THRESHOLD = 72

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles')
      .select('*, household:households(*)')
      .eq('id', user.id)
      .single()

    setProfile(prof)
    if (!prof?.household_id) { setLoading(false); return }

    const hid   = prof.household_id
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end   = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const month = currentDate.getMonth() + 1
    const year  = currentDate.getFullYear()

    // Previous month for delta
    const prevEnd   = format(endOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd')
    const nextStart = format(startOfMonth(addMonths(currentDate, 1)), 'yyyy-MM-dd')
    const nextEnd   = format(endOfMonth(addMonths(currentDate, 1)), 'yyyy-MM-dd')
    const creditStart = format(startOfMonth(subMonths(currentDate, 2)), 'yyyy-MM-dd')
    const creditEnd   = format(endOfMonth(addMonths(currentDate, 1)), 'yyyy-MM-dd')
    const today = new Date()
    const forecastEndDate = currentDate > today ? currentDate : today
    const forecastStart = format(startOfMonth(subMonths(today, 2)), 'yyyy-MM-dd')
    const forecastEnd = format(endOfMonth(addMonths(forecastEndDate, 1)), 'yyyy-MM-dd')

    const [txRes, goalsRes, catsRes, budgetsRes, banksRes, prevTxRes, nextTxRes, creditTxRes, forecastTxRes] = await Promise.all([
      supabase.from('transactions')
        .select('*, category:categories(*), bank:banks(*), profile:profiles(name, avatar_color, avatar_emoji)')
        .eq('household_id', hid).gte('date', start).lte('date', end).order('date', { ascending: false }),
      supabase.from('goals').select('*').eq('household_id', hid).eq('is_completed', false).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('household_id', hid),
      supabase.from('budgets').select('*, category:categories(*)').eq('household_id', hid).eq('month', month).eq('year', year),
      supabase.from('banks').select('*').eq('household_id', hid),
      supabase.from('transactions').select('amount, type, status, date, settled_at, bank_id, responsible_party, affects_household_cash, neusa_share_amount, is_neusa_reimbursement')
        .eq('household_id', hid).eq('status', 'realizado').gte('date', format(startOfMonth(subMonths(currentDate, 3)), 'yyyy-MM-dd')).lte('date', prevEnd),
      supabase.from('transactions')
        .select('*, category:categories(*), bank:banks(*), profile:profiles(name, avatar_color, avatar_emoji)')
        .eq('household_id', hid).gte('date', nextStart).lte('date', nextEnd).order('date', { ascending: true }),
      supabase.from('transactions')
        .select('*, category:categories(*), bank:banks(*), profile:profiles(name, avatar_color, avatar_emoji)')
        .eq('household_id', hid).gte('date', creditStart).lte('date', creditEnd).order('date', { ascending: false }),
      supabase.from('transactions')
        .select('*, category:categories(*), bank:banks(*)')
        .eq('household_id', hid).gte('date', forecastStart).lte('date', forecastEnd),
    ])

    setTransactions(txRes.data || [])
    setNextMonthTransactions((nextTxRes.data || []) as Transaction[])
    setCreditInvoiceTransactions((creditTxRes.data || []) as Transaction[])
    setForecastTransactions((forecastTxRes.data || []) as Transaction[])
    setGoals(goalsRes.data || [])
    setCategories(catsRes.data || [])
    setBudgets(budgetsRes.data || [])
    setBanks((banksRes.data || []) as Bank[])

    const fetchedBanks = (banksRes.data || []) as Bank[]
    // Previous month balance
    const prevTx = prevTxRes.data || []
    const prevProjection = calculateMonthProjection(prevTx as Transaction[], fetchedBanks, subMonths(currentDate, 1))
    setPrevBalance(prevProjection.householdResult)

    // Monthly history
    const history: { month: string; income: number; expenses: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(currentDate, i)
      const s = format(startOfMonth(subMonths(d, 2)), 'yyyy-MM-dd')
      const e = format(endOfMonth(d), 'yyyy-MM-dd')
      const { data } = await supabase.from('transactions').select('amount, type, status, date, settled_at, bank_id, responsible_party, affects_household_cash, neusa_share_amount, is_neusa_reimbursement')
        .eq('household_id', hid).eq('status', 'realizado').gte('date', s).lte('date', e)
      const projection = calculateMonthProjection((data || []) as Transaction[], fetchedBanks, d)
      history.push({ month: format(d, 'MMM', { locale: ptBR }), income: projection.operationalIncome, expenses: projection.directExpenses + projection.cardInvoice })
    }
    setMonthlyHistory(history)
    setLoading(false)
  }, [currentDate])

  useEffect(() => {
    setLoading(true)
    fetchData()
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'banks' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  // Derived
  const bankById = new Map(banks.map(bank => [bank.id, bank]))
  const isCreditTx = (tx: Transaction) => bankById.get(tx.bank_id || '')?.type === 'credito'
  const creditInvoiceDueThisMonth = creditInvoiceTransactions.filter(tx => {
    const bank = bankById.get(tx.bank_id || '')
    if (!bank || bank.type !== 'credito' || tx.type === 'receita' || tx.status !== 'realizado') return false
    return isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), currentDate)
  })
  const monthProjection = calculateMonthProjection([...transactions, ...creditInvoiceTransactions], banks, currentDate)
  const cashTransactions = transactions.filter(tx => !isCreditTx(tx))
  const isCouple = isCoupleTransaction
  const isNeusa = isNeusaTransaction
  const visibleCashTransactions = cashTransactions.filter(tx => isCouple(tx) || (tx.type === 'receita' && isNeusaReimbursement(tx)))
  const visibleCreditInvoices = creditInvoiceDueThisMonth
  const coupleBudgetTransactions = transactions.filter(tx => isCouple(tx) && tx.type !== 'receita')

  const visibleIncomeTransactions = transactions.filter(t => t.type === 'receita' && (isCouple(t) || isNeusaReimbursement(t)))
  const income = monthProjection.realizedOperationalIncome
  const plannedIncome = monthProjection.plannedOperationalIncome
  const neusaReimbursementIncome = monthProjection.reimbursementIncome
  const expenses = monthProjection.realizedDirectExpenses
  const plannedCashExpenses = monthProjection.plannedDirectExpenses
  const plannedCreditInvoices = monthProjection.cardInvoice
  const grossCardInvoiceTotal = monthProjection.grossCardInvoice
  const plannedExpenses = plannedCashExpenses + plannedCreditInvoices
  const balance  = income - expenses
  const projectedBalance = monthProjection.householdResult
  const cashBalance = banks.filter(bank => bank.type !== 'credito').reduce((sum, bank) => sum + Number(bank.current_balance || 0), 0)
  const { projectedCashBalance } = calculateAccumulatedCashForecast(forecastTransactions, banks, currentDate)
  const isHistoricalMonth = format(startOfMonth(currentDate), 'yyyy-MM-dd') < format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const neusaCardTransactions = creditInvoiceDueThisMonth.filter(isNeusa)
  const neusaDirectTransactions = cashTransactions.filter(t => isNeusa(t) && t.type !== 'receita')
  const sharedNeusaTransactions = [...cashTransactions, ...creditInvoiceDueThisMonth]
    .filter(t => isCouple(t) && t.type !== 'receita' && getNeusaShareAmount(t) > 0)
  const neusaReimbursementTransactions = cashTransactions.filter(tx => tx.type === 'receita' && isNeusaReimbursement(tx))
  const neusaTransactions = [...neusaCardTransactions, ...neusaDirectTransactions, ...sharedNeusaTransactions, ...neusaReimbursementTransactions]
  const neusaCardTotal = neusaCardTransactions.reduce((s, t) => s + Number(t.amount), 0)
  const neusaDirectTotal = neusaDirectTransactions.reduce((s, t) => s + Number(t.amount), 0)
  const neusaSharedCashTotal = cashTransactions.filter(tx => isCouple(tx)).reduce((sum, tx) => sum + getNeusaShareAmount(tx), 0)
  const neusaSharedCardTotal = creditInvoiceDueThisMonth.filter(tx => isCouple(tx)).reduce((sum, tx) => sum + getNeusaShareAmount(tx), 0)
  const neusaSharedTotal = neusaSharedCashTotal + neusaSharedCardTotal
  const neusaReceivedTotal = neusaReimbursementTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0)
  const neusaTotal = neusaCardTotal + neusaDirectTotal + neusaSharedTotal
  const neusaReceivableGross = neusaCardTransactions.filter(t => !t.is_reimbursed).reduce((s, t) => s + Number(t.amount), 0) + neusaSharedTotal
  const neusaReceivable = Math.max(0, neusaReceivableGross - neusaReceivedTotal)
  const cardInvoiceTotal = grossCardInvoiceTotal
  const nextPreviewMonth = addMonths(currentDate, 1)
  const futureCreditInvoices = creditInvoiceTransactions.filter(tx => {
    const bank = bankById.get(tx.bank_id || '')
    if (!bank || bank.type !== 'credito' || tx.type === 'receita' || tx.status !== 'realizado') return false
    return isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), nextPreviewMonth)
  })
  const futureDirectCoupleExpenses = nextMonthTransactions.filter(t => t.type !== 'receita' && isCouple(t) && !isCreditTx(t))
  const futureCoupleTransactions = [...futureDirectCoupleExpenses, ...futureCreditInvoices]

  const details: Record<DetailKind, { title: string; subtitle: string; transactions: Transaction[]; total?: number; amountResolver?: (tx: Transaction) => number }> = {
    income: {
      title: 'Receitas do casal',
      subtitle: `Entradas próprias do casal. Reembolso da Neuza (${brl(neusaReimbursementIncome)}) fica separado para não inflar a renda.`,
      transactions: visibleIncomeTransactions.filter(tx => !isNeusaReimbursement(tx)),
      total: income + plannedIncome,
    },
    expenses: {
      title: 'Despesas líquidas do casal',
      subtitle: `Gasto bruto ${brl(monthProjection.grossDirectExpenses)} menos coparticipação da Neuza ${brl(monthProjection.neusaSharedDirectExpenses)}.`,
      transactions: visibleCashTransactions.filter(t => t.type !== 'receita' && isCouple(t)),
      total: monthProjection.directExpenses,
      amountResolver: getHouseholdNetAmount,
    },
    balance: {
      title: 'Caixa do mês',
      subtitle: isHistoricalMonth
        ? 'Caixa real do período, incluindo reembolsos e todas as saídas que passaram pelas contas do casal.'
        : `Resultado líquido do casal: ${projectedBalance >= 0 ? '+' : ''}${brl(projectedBalance)}. Caixa previsto: ${brl(projectedCashBalance)}, já incluindo reembolsos recebidos da Neuza (${brl(neusaReimbursementIncome)}).`,
      transactions: [...visibleIncomeTransactions, ...cashTransactions.filter(t => t.type !== 'receita'), ...visibleCreditInvoices],
      total: monthProjection.cashResult,
    },
    planned: {
      title: 'Fatura cartão do casal',
      subtitle: `Fatura total ${brl(grossCardInvoiceTotal)}. Parte líquida do casal ${brl(plannedCreditInvoices)}; parte da Neuza ${brl(neusaCardTotal + neusaSharedCardTotal)}.`,
      transactions: visibleCreditInvoices.filter(isCouple),
      total: plannedCreditInvoices,
      amountResolver: getHouseholdNetAmount,
    },
    neusa: {
      title: 'Neuza no mês',
      subtitle: `Cartão direto ${brl(neusaCardTotal)} · coparticipação ${brl(neusaSharedTotal)} · reembolso recebido ${brl(neusaReceivedTotal)} · a receber ${brl(neusaReceivable)}`,
      transactions: neusaTransactions,
      total: neusaReceivable,
    },
    'future-income': {
      title: 'Receber na prévia',
      subtitle: 'Receitas do próximo mês selecionado na prévia',
      transactions: nextMonthTransactions.filter(t => t.type === 'receita'),
    },
    'future-couple': {
      title: 'Total cartão + despesas diretas',
      subtitle: 'Despesas diretas e compras de cartão do casal que vencem na prévia',
      transactions: futureCoupleTransactions.filter(isCouple),
      total: futureCoupleTransactions.filter(isCouple).reduce((sum, tx) => sum + getHouseholdNetAmount(tx), 0),
      amountResolver: getHouseholdNetAmount,
    },
    'future-expenses': {
      title: 'Despesas diretas da prévia',
      subtitle: 'Somente despesas do casal sem cartão de crédito',
      transactions: futureDirectCoupleExpenses,
      total: futureDirectCoupleExpenses.reduce((sum, tx) => sum + getHouseholdNetAmount(tx), 0),
      amountResolver: getHouseholdNetAmount,
    },
    'future-card': {
      title: 'Fatura cartão da prévia',
      subtitle: 'Compras do casal que caem na fatura prevista',
      transactions: futureCreditInvoices.filter(isCouple),
      total: futureCreditInvoices.filter(isCouple).reduce((sum, tx) => sum + getHouseholdNetAmount(tx), 0),
      amountResolver: getHouseholdNetAmount,
    },
  }

  const byCategory = categories
    .map(cat => ({
      category: cat,
      total: coupleBudgetTransactions
        .filter(t => t.category_id === cat.id)
        .reduce((s, t) => s + getHouseholdNetAmount(t), 0),
    }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total)

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    isAtTop.current = window.scrollY <= 2
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isAtTop.current || isRefreshing) return
    const dy = e.touches[0].clientY - touchStartY.current
    if (dy > 0) setPullY(Math.min(dy, PULL_THRESHOLD + 28))
  }
  const handleTouchEnd = async () => {
    if (pullY >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true); setPullY(0)
      await fetchData()
      setIsRefreshing(false)
    } else { setPullY(0) }
    isAtTop.current = false
  }

  const pullProgress    = Math.min(1, pullY / PULL_THRESHOLD)
  const showPullIndicator = pullY > 8 || isRefreshing

  return (
    <AppLayout profile={profile} onPlusClick={() => setShowAddModal(true)}>
      <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>

        {/* Pull-to-refresh */}
        {showPullIndicator && (
          <div className="flex justify-center items-center overflow-hidden"
            style={{ height: isRefreshing ? 44 : Math.max(0, (pullY - 8) * 0.55), transition: isRefreshing ? 'height 0.2s ease' : 'none' }}>
            <div className={`w-8 h-8 rounded-full border-2 border-primary-500 flex items-center justify-center flex-shrink-0 ${isRefreshing ? 'animate-spin border-t-transparent' : ''}`}
              style={{ opacity: isRefreshing ? 1 : pullProgress }}>
              {!isRefreshing && <RefreshCw className="w-3.5 h-3.5 text-primary-500" style={{ transform: `rotate(${pullProgress * 180}deg)` }} />}
            </div>
          </div>
        )}

        <div className="space-y-4 pb-24 md:pb-6">

          {/* â”€â”€ Row 1: Greeting + dollar rate + online indicator â”€â”€ */}
          <motion.div {...fadeUp(0)} className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>
                {getGreeting()}, {profile?.name?.split(' ')[0] ?? '...'} ðŸ‘‹
              </h1>
              <p className="text-sm" style={{ color: '#64748B' }}>
                {format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <OnlineIndicator householdId={profile?.household_id} />
              <DollarRate />
            </div>
          </motion.div>

          {/* â”€â”€ Row 2: Month selector â”€â”€ */}
          <motion.div {...fadeUp(0.05)}>
            <MonthSelector value={currentDate} onChange={d => { setCurrentDate(d); setLoading(true) }} />
          </motion.div>

          <motion.div {...fadeUp(0.065)}>
            <DailyTip month={currentDate} />
          </motion.div>

          <motion.div {...fadeUp(0.068)}>
            <FinancialAlerts
              projectedBalance={projectedBalance}
              cashBalance={cashBalance}
              neusaReceivable={neusaReceivable}
              budgets={budgets}
              transactions={coupleBudgetTransactions}
              creditInvoiceTotal={cardInvoiceTotal}
              selectedMonth={currentDate}
              loading={loading}
            />
          </motion.div>

          <motion.div {...fadeUp(0.07)}>
            <AccountBalancesCard banks={banks} loading={loading} />
          </motion.div>

          {/* â”€â”€ Row 3: Main balance card (quick stats) â”€â”€ */}
          <motion.div {...fadeUp(0.08)}>
            <MonthlyCommandCenter
              income={income}
              plannedIncome={plannedIncome}
              reimbursementIncome={neusaReimbursementIncome}
              expenses={expenses}
              plannedCashExpenses={plannedCashExpenses}
              plannedCreditInvoices={plannedCreditInvoices}
              balance={balance}
              projectedBalance={projectedBalance}
              cashBalance={cashBalance}
              projectedCashBalance={projectedCashBalance}
              prevBalance={prevBalance}
              neusaTotal={neusaTotal}
              neusaReceivable={neusaReceivable}
              neusaDirectTotal={neusaDirectTotal}
              historical={isHistoricalMonth}
              loading={loading}
              onOpen={setDetailKind}
            />
          </motion.div>

          {/* â”€â”€ Row 4.5: Future preview â”€â”€ */}
          <motion.div {...fadeUp(0.135)}>
            <FuturePreview
              targetMonth={addMonths(currentDate, 1)}
              transactions={nextMonthTransactions}
              creditTransactions={creditInvoiceTransactions}
              banks={banks}
              loading={loading}
              onOpen={setDetailKind}
            />
          </motion.div>

          {/* â”€â”€ Row 5: Patrimônio (savings + investments) â”€â”€ */}
          {profile?.household_id && (
            <motion.div {...fadeUp(0.15)}>
              <PatrimonyCard householdId={profile.household_id} loading={loading} />
            </motion.div>
          )}

          {/* â”€â”€ Row 7: Charts â”€â”€ */}
          <motion.div {...fadeUp(0.21)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ExpenseChart data={monthlyHistory} loading={loading} />
            <CategoryChart data={byCategory} loading={loading} />
          </motion.div>

          {/* â”€â”€ Row 8: Budgets â”€â”€ */}
          <motion.div {...fadeUp(0.24)}>
            <BudgetsMini budgets={budgets} transactions={coupleBudgetTransactions} loading={loading} />
          </motion.div>

          {/* â”€â”€ Row 9: Credit cards â”€â”€ */}
          <motion.div {...fadeUp(0.27)}>
            <CreditCardSummary banks={banks} transactions={creditInvoiceTransactions} loading={loading} selectedMonth={currentDate} />
          </motion.div>

          {/* â”€â”€ Row 10: Goals â”€â”€ */}
          <motion.div {...fadeUp(0.30)}>
            <GoalsMini goals={goals.slice(0, 3)} loading={loading} />
          </motion.div>

        </div>
      </div>

      <AddTransactionModal open={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={fetchData} />
      <DetailModal
        open={!!detailKind}
        title={detailKind ? details[detailKind].title : ''}
        subtitle={detailKind ? details[detailKind].subtitle : ''}
        transactions={detailKind ? details[detailKind].transactions : []}
        totalOverride={detailKind ? details[detailKind].total : undefined}
        breakdownByBank={detailKind === 'planned' || detailKind === 'future-card'}
        amountResolver={detailKind ? details[detailKind].amountResolver : undefined}
        onClose={() => setDetailKind(null)}
      />
    </AppLayout>
  )
}

