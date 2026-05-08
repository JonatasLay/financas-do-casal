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
import { MonthSelector } from '@/components/ui/MonthSelector'
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal'
import { RefreshCw } from 'lucide-react'
import type { Transaction, Goal, Category, Budget } from '@/types'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Animation helpers ────────────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, delay, ease: [0.25, 0.46, 0.45, 0.94] as const },
})

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const supabase = createClient()

  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [monthlyHistory, setMonthlyHistory] = useState<{ month: string; income: number; expenses: number }[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)

  // Pull-to-refresh state
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const isAtTop = useRef(false)
  const PULL_THRESHOLD = 72

  // ── Data fetching ────────────────────────────────────────────────────────────

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

    const hid = prof.household_id
    // Use local start/end derived from currentDate — no stale module-level variable
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end   = format(endOfMonth(currentDate),   'yyyy-MM-dd')
    const month = currentDate.getMonth() + 1
    const year  = currentDate.getFullYear()

    const [txRes, goalsRes, catsRes, budgetsRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(*), bank:banks(*), profile:profiles(name, avatar_color, avatar_emoji)')
        .eq('household_id', hid)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false }),
      supabase
        .from('goals')
        .select('*')
        .eq('household_id', hid)
        .eq('is_completed', false)
        .order('created_at', { ascending: false }),
      supabase
        .from('categories')
        .select('*')
        .eq('household_id', hid),
      supabase
        .from('budgets')
        .select('*, category:categories(*)')
        .eq('household_id', hid)
        .eq('month', month)
        .eq('year', year),
    ])

    setTransactions(txRes.data || [])
    setGoals(goalsRes.data || [])
    setCategories(catsRes.data || [])
    setBudgets(budgetsRes.data || [])

    // Historical 6-month data for the bar chart
    const history: { month: string; income: number; expenses: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d  = subMonths(currentDate, i)
      const s  = format(startOfMonth(d), 'yyyy-MM-dd')
      const e  = format(endOfMonth(d),   'yyyy-MM-dd')
      const { data } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('household_id', hid)
        .eq('status', 'realizado')
        .gte('date', s)
        .lte('date', e)
      const inc = (data || []).filter(t => t.type === 'receita').reduce((acc, t) => acc + Number(t.amount), 0)
      const exp = (data || []).filter(t => t.type !== 'receita').reduce((acc, t) => acc + Number(t.amount), 0)
      history.push({ month: format(d, 'MMM', { locale: ptBR }), income: inc, expenses: exp })
    }
    setMonthlyHistory(history)
    setLoading(false)
  }, [currentDate])

  useEffect(() => {
    setLoading(true)
    fetchData()

    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  // ── Derived values ───────────────────────────────────────────────────────────

  const income   = transactions.filter(t => t.type === 'receita' && t.status === 'realizado').reduce((s, t) => s + Number(t.amount), 0)
  const expenses = transactions.filter(t => t.type !== 'receita' && t.status === 'realizado').reduce((s, t) => s + Number(t.amount), 0)
  const pending  = transactions.filter(t => t.status === 'pendente').reduce((s, t) => s + Number(t.amount), 0)

  const byCategory = categories
    .map(cat => ({
      category: cat,
      total: transactions
        .filter(t => t.category_id === cat.id && t.type !== 'receita' && t.status === 'realizado')
        .reduce((s, t) => s + Number(t.amount), 0),
    }))
    .filter(x => x.total > 0)
    .sort((a, b) => b.total - a.total)

  // ── Pull-to-refresh handlers ─────────────────────────────────────────────────

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
      setIsRefreshing(true)
      setPullY(0)
      await fetchData()
      setIsRefreshing(false)
    } else {
      setPullY(0)
    }
    isAtTop.current = false
  }

  // Animate the pull indicator
  const pullProgress = Math.min(1, pullY / PULL_THRESHOLD)
  const showPullIndicator = pullY > 8 || isRefreshing

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <AppLayout profile={profile} onPlusClick={() => setShowAddModal(true)}>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        {showPullIndicator && (
          <div
            className="flex justify-center items-center overflow-hidden"
            style={{
              height: isRefreshing ? 44 : Math.max(0, (pullY - 8) * 0.55),
              transition: isRefreshing ? 'height 0.2s ease' : 'none',
            }}
          >
            <div
              className={`w-8 h-8 rounded-full border-2 border-primary-500 flex items-center justify-center flex-shrink-0
                ${isRefreshing ? 'animate-spin border-t-transparent' : ''}`}
              style={{ opacity: isRefreshing ? 1 : pullProgress }}
            >
              {!isRefreshing && (
                <RefreshCw
                  className="w-3.5 h-3.5 text-primary-500"
                  style={{ transform: `rotate(${pullProgress * 180}deg)` }}
                />
              )}
            </div>
          </div>
        )}

        <div className="space-y-4 pb-24 md:pb-6">
          {/* Greeting + online indicator */}
          <motion.div {...fadeUp(0)} className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                Olá, {profile?.name?.split(' ')[0] ?? '...'} 👋
              </h1>
              <p className="text-sm text-gray-500">Aqui está seu resumo</p>
            </div>
            <OnlineIndicator householdId={profile?.household_id} />
          </motion.div>

          {/* Month selector */}
          <motion.div {...fadeUp(0.05)}>
            <MonthSelector
              value={currentDate}
              onChange={d => { setCurrentDate(d); setLoading(true) }}
            />
          </motion.div>

          {/* AI daily tip */}
          <motion.div {...fadeUp(0.1)}>
            <DailyTip />
          </motion.div>

          {/* Summary cards */}
          <motion.div {...fadeUp(0.15)}>
            <SummaryCards
              income={income}
              expenses={expenses}
              pending={pending}
              loading={loading}
            />
          </motion.div>

          {/* Charts */}
          <motion.div {...fadeUp(0.2)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ExpenseChart data={monthlyHistory} loading={loading} />
            <CategoryChart data={byCategory} loading={loading} />
          </motion.div>

          {/* Budgets */}
          <motion.div {...fadeUp(0.25)}>
            <BudgetsMini
              budgets={budgets}
              transactions={transactions}
              loading={loading}
            />
          </motion.div>

          {/* Goals */}
          <motion.div {...fadeUp(0.3)}>
            <GoalsMini goals={goals.slice(0, 3)} loading={loading} />
          </motion.div>

          {/* Recent transactions */}
          <motion.div {...fadeUp(0.35)}>
            <RecentTransactions
              transactions={transactions.slice(0, 8)}
              loading={loading}
              onRefresh={fetchData}
            />
          </motion.div>
        </div>
      </div>

      {/* Add transaction modal — opened from mobile header (+) button */}
      <AddTransactionModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchData}
      />
    </AppLayout>
  )
}
