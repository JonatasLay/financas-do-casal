import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateGoalInsight } from '@/lib/ai'
import { AIContext } from '@/types'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const goalId = req.nextUrl.searchParams.get('goalId')
    if (!goalId) return NextResponse.json({ tip: null }, { status: 400 })

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ tip: null }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('household_id, name').eq('id', user.id).single()
    if (!profile?.household_id) return NextResponse.json({ tip: null }, { status: 401 })

    const { data: goal } = await supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .eq('household_id', profile.household_id)
      .single()
    if (!goal) return NextResponse.json({ tip: null }, { status: 404 })

    const now = new Date()
    const start = format(startOfMonth(now), 'yyyy-MM-dd')
    const end = format(endOfMonth(now), 'yyyy-MM-dd')
    const creditStart = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd')

    const [txRes, creditTxRes, banksRes, goalsRes, savingsRes, investRes] = await Promise.all([
      supabase.from('transactions').select('*, category:categories(name, icon), bank:banks(*)').eq('household_id', profile.household_id).gte('date', start).lte('date', end),
      supabase.from('transactions').select('*, category:categories(name, icon), bank:banks(*)').eq('household_id', profile.household_id).eq('status', 'realizado').gte('date', creditStart).lte('date', end),
      supabase.from('banks').select('*').eq('household_id', profile.household_id),
      supabase.from('goals').select('name,target_amount,current_amount,icon').eq('household_id', profile.household_id).eq('is_completed', false),
      supabase.from('savings').select('name,type,current_amount,interest_rate').eq('household_id', profile.household_id),
      supabase.from('investments').select('name,type,total_invested,current_price,quantity,avg_price').eq('household_id', profile.household_id),
    ])

    const txs = txRes.data || []
    const banks = banksRes.data || []
    const bankById = new Map<string, any>(banks.map((bank: any) => [bank.id, bank]))
    const isCreditTx = (tx: any) => bankById.get(tx.bank_id || '')?.type === 'credito'
    const isCoupleTx = (tx: any) => (tx.responsible_party || 'casal') === 'casal'
    const coupleTxs = txs.filter(isCoupleTx)
    const cashTxs = coupleTxs.filter((tx: any) => !isCreditTx(tx))
    const creditInvoiceTxs = (creditTxRes.data || []).filter((tx: any) => {
      const bank = bankById.get(tx.bank_id || '')
      if (!isCoupleTx(tx) || !bank || bank.type !== 'credito' || tx.type === 'receita') return false
      return isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), now)
    })

    const income = coupleTxs.filter((tx: any) => tx.type === 'receita' && tx.status === 'realizado').reduce((s: number, tx: any) => s + Number(tx.amount), 0)
    const plannedIncome = coupleTxs.filter((tx: any) => tx.type === 'receita' && tx.status !== 'realizado').reduce((s: number, tx: any) => s + Number(tx.amount), 0)
    const expenses = cashTxs.filter((tx: any) => tx.type !== 'receita' && tx.status === 'realizado').reduce((s: number, tx: any) => s + Number(tx.amount), 0)
    const plannedExpenses = cashTxs.filter((tx: any) => tx.type !== 'receita' && tx.status !== 'realizado').reduce((s: number, tx: any) => s + Number(tx.amount), 0)
      + creditInvoiceTxs.reduce((s: number, tx: any) => s + Number(tx.amount), 0)
    const bankBalances = banks.filter((bank: any) => bank.type !== 'credito').map((bank: any) => ({ name: bank.name, type: bank.type, balance: Number(bank.current_balance || 0) }))
    const savings = (savingsRes.data || []).map((s: any) => ({ name: s.name, type: s.type, amount: Number(s.current_amount), rate: s.interest_rate ? Number(s.interest_rate) : null }))
    const investments = (investRes.data || []).map((i: any) => {
      const current = Number(i.quantity || 0) * Number(i.current_price || 0)
      return { name: i.name, type: i.type, invested: Number(i.total_invested || 0), current, pl: current - Number(i.total_invested || 0) }
    })

    const context: AIContext = {
      current_month_income: income,
      current_month_expenses: expenses,
      current_month_balance: income - expenses,
      planned_month_income: plannedIncome,
      planned_month_expenses: plannedExpenses,
      projected_month_balance: income + plannedIncome - expenses - plannedExpenses,
      projected_cash_balance: bankBalances.reduce((s: number, bank: any) => s + bank.balance, 0) + income + plannedIncome - expenses - plannedExpenses,
      cash_balance: bankBalances.reduce((s: number, bank: any) => s + bank.balance, 0),
      bank_balances: bankBalances,
      credit_card_bills: banks.filter((bank: any) => bank.type === 'credito').map((bank: any) => ({
        name: bank.name,
        due_day: bank.due_day,
        closing_day: bank.closing_day,
        amount: creditInvoiceTxs.filter((tx: any) => tx.bank_id === bank.id).reduce((s: number, tx: any) => s + Number(tx.amount), 0),
      })).filter((bill: any) => bill.amount > 0),
      top_expense_categories: [],
      goals: (goalsRes.data || []).map((g: any) => ({ name: g.name, target: Number(g.target_amount), current: Number(g.current_amount), icon: g.icon })),
      monthly_history: [],
      profiles: [{ name: profile.name }],
      savings,
      investments,
      total_patrimony: savings.reduce((s: number, item: any) => s + item.amount, 0) + investments.reduce((s: number, item: any) => s + item.current, 0),
    }

    return NextResponse.json({
      tip: await generateGoalInsight(context, {
        name: goal.name,
        target: Number(goal.target_amount),
        current: Number(goal.current_amount),
        monthly: Number(goal.monthly_contribution || 0),
        deadline: goal.deadline,
      }),
    })
  } catch {
    return NextResponse.json({ tip: 'Nao consegui analisar esta meta agora. Revise os dados e tente novamente.' })
  }
}
