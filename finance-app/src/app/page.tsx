'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { SummaryCards } from '@/components/dashboard/SummaryCards'
import { ExpenseChart } from '@/components/dashboard/ExpenseChart'
import { CategoryChart } from '@/components/dashboard/CategoryChart'
import { GoalsMini } from '@/components/dashboard/GoalsMini'
import { RecentTransactions } from '@/components/dashboard/RecentTransactions'
import { DailyTip } from '@/components/dashboard/DailyTip'
import { OnlineIndicator } from '@/components/dashboard/OnlineIndicator'
import { BudgetsMini } from '@/components/dashboard/BudgetsMini'
import { CreditCardSummary } from '@/components/dashboard/CreditCardSummary'
import { FuturePreview } from '@/components/dashboard/FuturePreview'
import { DollarRate } from '@/components/dashboard/DollarRate'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'
import { RefreshCw, TrendingUp, PiggyBank, Wallet, ArrowUpRight, ArrowDownRight, X, Landmark } from 'lucide-react'
import type { Transaction, Goal, Category, Budget, Bank } from '@/types'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
})

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

type DetailKind = 'income' | 'expenses' | 'balance' | 'planned' | 'neusa' | 'future-income' | 'future-couple' | 'future-card'

function DetailModal({ open, title, subtitle, transactions, onClose }: {
  open: boolean
  title: string
  subtitle?: string
  transactions: Transaction[]
  onClose: () => void
}) {
  if (!open) return null
  const total = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0)

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

        <div className="p-4 space-y-2 overflow-y-auto max-h-[64dvh]">
          {transactions.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: '#64748B' }}>Nenhum lançamento neste grupo.</p>
          ) : transactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#F1F5F9' }}>{tx.description}</p>
                <p className="text-[11px]" style={{ color: '#64748B' }}>
                  {format(new Date(`${tx.date}T12:00:00`), 'dd/MM/yyyy')} · {tx.status}
                  {tx.bank?.name ? ` · ${tx.bank.name}` : ''}
                  {tx.responsible_party === 'sogra' ? ' · Neusa' : ''}
                </p>
              </div>
              <p className="text-sm font-bold font-mono-nums flex-shrink-0" style={{ color: tx.type === 'receita' ? '#34D399' : '#F87171' }}>
                {tx.type === 'receita' ? '+' : '-'}{brl(Number(tx.amount))}
              </p>
            </div>
          ))}
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

// ─── Patrimônio Card ──────────────────────────────────────────────────────────

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

// ─── Quick Stats Bar ──────────────────────────────────────────────────────────

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
            <p className="text-[10px] uppercase tracking-wide truncate" style={{ color: '#64748B' }}>{bank.name}</p>
            <p className="text-sm font-bold font-mono-nums mt-0.5" style={{ color: '#F1F5F9' }}>{brl(Number(bank.current_balance || 0))}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = createClient()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [nextMonthTransactions, setNextMonthTransactions] = useState<Transaction[]>([])
  const [creditInvoiceTransactions, setCreditInvoiceTransactions] = useState<Transaction[]>([])
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
    const prevStart = format(startOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd')
    const prevEnd   = format(endOfMonth(subMonths(currentDate, 1)), 'yyyy-MM-dd')
    const nextStart = format(startOfMonth(addMonths(currentDate, 1)), 'yyyy-MM-dd')
    const nextEnd   = format(endOfMonth(addMonths(currentDate, 1)), 'yyyy-MM-dd')
    const creditStart = format(startOfMonth(subMonths(currentDate, 2)), 'yyyy-MM-dd')
    const creditEnd   = format(endOfMonth(addMonths(currentDate, 1)), 'yyyy-MM-dd')

    const [txRes, goalsRes, catsRes, budgetsRes, banksRes, prevTxRes, nextTxRes, creditTxRes] = await Promise.all([
      supabase.from('transactions')
        .select('*, category:categories(*), bank:banks(*), profile:profiles(name, avatar_color, avatar_emoji)')
        .eq('household_id', hid).gte('date', start).lte('date', end).order('date', { ascending: false }),
      supabase.from('goals').select('*').eq('household_id', hid).eq('is_completed', false).order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('household_id', hid),
      supabase.from('budgets').select('*, category:categories(*)').eq('household_id', hid).eq('month', month).eq('year', year),
      supabase.from('banks').select('*').eq('household_id', hid),
      supabase.from('transactions').select('amount, type, status')
        .eq('household_id', hid).eq('status', 'realizado').gte('date', prevStart).lte('date', prevEnd),
      supabase.from('transactions')
        .select('*, category:categories(*), bank:banks(*), profile:profiles(name, avatar_color, avatar_emoji)')
        .eq('household_id', hid).gte('date', nextStart).lte('date', nextEnd).order('date', { ascending: true }),
      supabase.from('transactions')
        .select('*, category:categories(*), bank:banks(*), profile:profiles(name, avatar_color, avatar_emoji)')
        .eq('household_id', hid).gte('date', creditStart).lte('date', creditEnd).order('date', { ascending: false }),
    ])

    setTransactions(txRes.data || [])
    setNextMonthTransactions((nextTxRes.data || []) as Transaction[])
    setCreditInvoiceTransactions((creditTxRes.data || []) as Transaction[])
    setGoals(goalsRes.data || [])
    setCategories(catsRes.data || [])
    setBudgets(budgetsRes.data || [])
    setBanks((banksRes.data || []) as Bank[])

    // Previous month balance
    const prevTx = prevTxRes.data || []
    const pIncome   = prevTx.filter(t => t.type === 'receita').reduce((s, t) => s + Number(t.amount), 0)
    const pExpenses = prevTx.filter(t => t.type !== 'receita').reduce((s, t) => s + Number(t.amount), 0)
    setPrevBalance(pIncome - pExpenses)

    // Monthly history
    const history: { month: string; income: number; expenses: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(currentDate, i)
      const s = format(startOfMonth(d), 'yyyy-MM-dd')
      const e = format(endOfMonth(d), 'yyyy-MM-dd')
      const { data } = await supabase.from('transactions').select('amount, type')
        .eq('household_id', hid).eq('status', 'realizado').gte('date', s).lte('date', e)
      const inc = (data || []).filter(t => t.type === 'receita').reduce((a, t) => a + Number(t.amount), 0)
      const exp = (data || []).filter(t => t.type !== 'receita').reduce((a, t) => a + Number(t.amount), 0)
      history.push({ month: format(d, 'MMM', { locale: ptBR }), income: inc, expenses: exp })
    }
    setMonthlyHistory(history)
    setLoading(false)
  }, [currentDate])

  useEffect(() => {
    setLoading(true)
    fetchData()
    const channel = supabase.channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchData)
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
  const cashTransactions = transactions.filter(tx => !isCreditTx(tx))
  const financialTransactions = [...cashTransactions, ...creditInvoiceDueThisMonth]
  const isCouple = (tx: Transaction) => (tx.responsible_party || 'casal') === 'casal'
  const isNeusa = (tx: Transaction) => tx.responsible_party === 'sogra'
  const visibleCashTransactions = cashTransactions.filter(isCouple)
  const visibleCreditInvoices = creditInvoiceDueThisMonth.filter(isCouple)
  const coupleFinancialTransactions = financialTransactions.filter(tx => (tx.responsible_party || 'casal') === 'casal')

  const visibleIncomeTransactions = transactions.filter(t => t.type === 'receita')
  const income = visibleIncomeTransactions.filter(t => t.status === 'realizado').reduce((s, t) => s + Number(t.amount), 0)
  const plannedIncome = visibleIncomeTransactions.filter(t => t.status !== 'realizado').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = visibleCashTransactions
    .filter(t => t.type !== 'receita' && t.status === 'realizado')
    .reduce((s, t) => s + Number(t.amount), 0)
  const plannedCashExpenses = visibleCashTransactions
    .filter(t => t.type !== 'receita' && t.status !== 'realizado')
    .reduce((s, t) => s + Number(t.amount), 0)
  const plannedCreditInvoices = visibleCreditInvoices.reduce((s, t) => s + Number(t.amount), 0)
  const plannedExpenses = plannedCashExpenses + plannedCreditInvoices
  const pending = plannedExpenses
  const balance  = income - expenses
  const projectedBalance = income + plannedIncome - expenses - plannedExpenses
  const neusaTransactions = financialTransactions.filter(isNeusa)
  const neusaTotal = neusaTransactions.reduce((s, t) => s + Number(t.amount), 0)
  const neusaCardTotal = creditInvoiceDueThisMonth.filter(isNeusa).reduce((s, t) => s + Number(t.amount), 0)
  const neusaReceivable = neusaTransactions
    .filter(t => !t.is_reimbursed)
    .reduce((s, t) => s + Number(t.amount), 0)
  const cardInvoiceTotal = creditInvoiceDueThisMonth.reduce((s, t) => s + Number(t.amount), 0)

  const details: Record<DetailKind, { title: string; subtitle: string; transactions: Transaction[] }> = {
    income: { title: 'Receitas do mês', subtitle: 'Recebidas e previstas/agendadas no mês selecionado', transactions: visibleIncomeTransactions },
    expenses: { title: 'Despesas do casal', subtitle: 'Saídas de caixa realizadas e agendadas, sem compras de crédito antes da fatura', transactions: visibleCashTransactions.filter(t => t.type !== 'receita') },
    balance: { title: 'Composição do saldo', subtitle: `Realizado ${brl(balance)} · Projetado ${brl(projectedBalance)}`, transactions: [...visibleIncomeTransactions, ...visibleCashTransactions.filter(t => t.type !== 'receita'), ...visibleCreditInvoices] },
    planned: { title: 'Previstos e faturas', subtitle: 'Despesas agendadas e compras de cartão pela fatura do mês', transactions: [...visibleCashTransactions.filter(t => t.type !== 'receita' && t.status !== 'realizado'), ...visibleCreditInvoices] },
    neusa: { title: 'Neusa no mês', subtitle: `Cartão ${brl(neusaCardTotal)} · a receber ${brl(neusaReceivable)}`, transactions: neusaTransactions },
    'future-income': { title: 'Receber na prévia', subtitle: 'Receitas do próximo mês selecionado na prévia', transactions: nextMonthTransactions.filter(t => t.type === 'receita') },
    'future-couple': { title: 'Casal na prévia', subtitle: 'Despesas diretas do casal no próximo mês', transactions: nextMonthTransactions.filter(t => t.type !== 'receita' && (t.responsible_party || 'casal') === 'casal' && !isCreditTx(t)) },
    'future-card': { title: 'Fatura real da prévia', subtitle: 'Compras que caem na fatura prevista', transactions: creditInvoiceTransactions.filter(tx => tx.type !== 'receita' && tx.status === 'realizado' && isDateInMonth(getCreditCardPaymentDate(tx.date, bankById.get(tx.bank_id || '')?.due_day, bankById.get(tx.bank_id || '')?.closing_day), addMonths(currentDate, 1))) },
  }

  const byCategory = categories
    .map(cat => ({
      category: cat,
      total: coupleFinancialTransactions
        .filter(t => t.category_id === cat.id && t.type !== 'receita' && t.status === 'realizado')
        .reduce((s, t) => s + Number(t.amount), 0),
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

          {/* ── Row 1: Greeting + dollar rate + online indicator ── */}
          <motion.div {...fadeUp(0)} className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>
                {getGreeting()}, {profile?.name?.split(' ')[0] ?? '...'} 👋
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

          {/* ── Row 2: Month selector ── */}
          <motion.div {...fadeUp(0.05)}>
            <MonthSelector value={currentDate} onChange={d => { setCurrentDate(d); setLoading(true) }} />
          </motion.div>

          <motion.div {...fadeUp(0.065)}>
            <DailyTip month={currentDate} />
          </motion.div>

          {/* ── Row 3: Main balance card (quick stats) ── */}
          <motion.div {...fadeUp(0.08)}>
            <QuickStats income={income} expenses={expenses} balance={balance} prevBalance={prevBalance} loading={loading} />
          </motion.div>

          {/* ── Row 4: Summary cards (pending, etc) ── */}
          <motion.div {...fadeUp(0.12)}>
            <SummaryCards
              income={income}
              expenses={expenses}
              pending={pending}
              plannedIncome={plannedIncome}
              plannedExpenses={plannedExpenses}
              neusaTotal={neusaTotal}
              neusaReceivable={neusaReceivable}
              loading={loading}
              onOpen={setDetailKind}
            />
          </motion.div>

          {/* ── Row 4.5: Future preview ── */}
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

          <motion.div {...fadeUp(0.145)}>
            <AccountBalancesCard banks={banks} loading={loading} />
          </motion.div>

          {/* ── Row 5: Patrimônio (savings + investments) ── */}
          {profile?.household_id && (
            <motion.div {...fadeUp(0.15)}>
              <PatrimonyCard householdId={profile.household_id} loading={loading} />
            </motion.div>
          )}

          {/* ── Row 7: Charts ── */}
          <motion.div {...fadeUp(0.21)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ExpenseChart data={monthlyHistory} loading={loading} />
            <CategoryChart data={byCategory} loading={loading} />
          </motion.div>

          {/* ── Row 8: Budgets ── */}
          <motion.div {...fadeUp(0.24)}>
            <BudgetsMini budgets={budgets} transactions={coupleFinancialTransactions} loading={loading} />
          </motion.div>

          {/* ── Row 9: Credit cards ── */}
          <motion.div {...fadeUp(0.27)}>
            <CreditCardSummary banks={banks} transactions={creditInvoiceTransactions} loading={loading} selectedMonth={currentDate} />
          </motion.div>

          {/* ── Row 10: Goals ── */}
          <motion.div {...fadeUp(0.30)}>
            <GoalsMini goals={goals.slice(0, 3)} loading={loading} />
          </motion.div>

          {/* ── Row 11: Recent transactions ── */}
          <motion.div {...fadeUp(0.33)}>
            <RecentTransactions transactions={transactions.slice(0, 8)} loading={loading} onRefresh={fetchData} />
          </motion.div>

        </div>
      </div>

      <AddTransactionModal open={showAddModal} onClose={() => setShowAddModal(false)} onSuccess={fetchData} />
      <DetailModal
        open={!!detailKind}
        title={detailKind ? details[detailKind].title : ''}
        subtitle={detailKind ? details[detailKind].subtitle : ''}
        transactions={detailKind ? details[detailKind].transactions : []}
        onClose={() => setDetailKind(null)}
      />
    </AppLayout>
  )
}
