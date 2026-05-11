import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

import { createClient } from '@/lib/supabase/server'
import { chatWithFina, analyzePurchase, analyzeInvestments } from '@/lib/ai'
import { AIContext, AIMessage } from '@/types'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, mode, purchaseItem, purchasePrice, investmentQuestion } = await req.json()
    const context = await buildFinancialContext(supabase, user.id)

    if (mode === 'purchase' && purchaseItem && purchasePrice) {
      return NextResponse.json({ response: await analyzePurchase(purchaseItem, purchasePrice, context) })
    }
    if (mode === 'investment' && investmentQuestion) {
      return NextResponse.json({ response: await analyzeInvestments(context, investmentQuestion) })
    }

    return NextResponse.json({ response: await chatWithFina(messages as AIMessage[], context) })
  } catch (error) {
    console.error('AI API error:', error)
    return NextResponse.json({ error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

async function buildFinancialContext(supabase: any, userId: string): Promise<AIContext> {
  const now    = new Date()
  const start  = format(startOfMonth(now), 'yyyy-MM-dd')
  const end    = format(endOfMonth(now),   'yyyy-MM-dd')
  const creditStart = format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd')
  const creditEnd = format(endOfMonth(addMonths(now, 1)), 'yyyy-MM-dd')

  const { data: profile } = await supabase.from('profiles').select('household_id, name').eq('id', userId).single()
  if (!profile) throw new Error('Profile not found')

  const hid = profile.household_id
  const { data: allProfiles } = await supabase.from('profiles').select('name').eq('household_id', hid)

  const [txRes, creditTxRes, goalsRes, savingsRes, investRes, banksRes] = await Promise.all([
    supabase.from('transactions').select('*, category:categories(name,icon), bank:banks(*)').eq('household_id', hid).gte('date',start).lte('date',end),
    supabase.from('transactions').select('*, category:categories(name,icon), bank:banks(*)').eq('household_id', hid).eq('status','realizado').gte('date',creditStart).lte('date',creditEnd),
    supabase.from('goals').select('name,target_amount,current_amount,icon').eq('household_id', hid).eq('is_completed', false),
    supabase.from('savings').select('name,type,current_amount,interest_rate').eq('household_id', hid),
    supabase.from('investments').select('name,type,total_invested,current_price,quantity,avg_price').eq('household_id', hid),
    supabase.from('banks').select('*').eq('household_id', hid),
  ])

  const txs      = txRes.data || []
  const banks    = banksRes.data || []
  const bankById = new Map<string, any>(banks.map((bank: any) => [bank.id, bank]))
  const isCreditTx = (tx: any) => bankById.get(tx.bank_id || '')?.type === 'credito'
  const cashTxs = txs.filter((tx: any) => !isCreditTx(tx))
  const creditInvoiceTxs = (creditTxRes.data || []).filter((tx: any) => {
    const bank = bankById.get(tx.bank_id || '')
    if (!bank || bank.type !== 'credito' || tx.type === 'receita') return false
    return isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), now)
  })

  const income = txs
    .filter((t: any) => t.type === 'receita' && t.status === 'realizado')
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
  const plannedIncome = txs
    .filter((t: any) => t.type === 'receita' && t.status !== 'realizado')
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expenses = cashTxs
    .filter((t: any) => t.type !== 'receita' && t.status === 'realizado')
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
  const plannedExpenses = cashTxs
    .filter((t: any) => t.type !== 'receita' && t.status !== 'realizado')
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
    + creditInvoiceTxs.reduce((s: number, t: any) => s + Number(t.amount), 0)

  const catMap: Record<string, { name: string; icon: string; amount: number }> = {}
  for (const tx of [...cashTxs, ...creditInvoiceTxs] as any[]) {
    if (tx.type !== 'receita' && tx.category) {
      const k = tx.category.name
      if (!catMap[k]) catMap[k] = { name: k, icon: tx.category.icon, amount: 0 }
      catMap[k].amount += Number(tx.amount)
    }
  }

  const savings    = (savingsRes.data || []).map((s: any) => ({ name: s.name, type: s.type, amount: Number(s.current_amount), rate: s.interest_rate ? Number(s.interest_rate) : null }))
  const totalSaved = savings.reduce((s: number, sv: any) => s + sv.amount, 0)

  const investments = (investRes.data || []).map((i: any) => {
    const currentVal = Number(i.quantity) * Number(i.current_price)
    const invested   = Number(i.total_invested)
    return { name: i.name, type: i.type, invested, current: currentVal, pl: currentVal - invested }
  })
  const totalInvested = investments.reduce((s: number, i: any) => s + i.invested, 0)
  const totalInvestValue = investments.reduce((s: number, i: any) => s + i.current, 0)
  const bankBalances = banks
    .filter((bank: any) => bank.type !== 'credito')
    .map((bank: any) => ({ name: bank.name, type: bank.type, balance: Number(bank.current_balance || 0) }))
  const cashBalance = bankBalances.reduce((s: number, bank: any) => s + bank.balance, 0)
  const creditCardBills = banks
    .filter((bank: any) => bank.type === 'credito')
    .map((bank: any) => ({
      name: bank.name,
      due_day: bank.due_day,
      closing_day: bank.closing_day,
      amount: creditInvoiceTxs
        .filter((tx: any) => tx.bank_id === bank.id)
        .reduce((s: number, tx: any) => s + Number(tx.amount), 0),
    }))
    .filter((bill: any) => bill.amount > 0)

  return {
    current_month_income:    income,
    current_month_expenses:  expenses,
    current_month_balance:   income - expenses,
    planned_month_income: plannedIncome,
    planned_month_expenses: plannedExpenses,
    projected_month_balance: income + plannedIncome - expenses - plannedExpenses,
    cash_balance: cashBalance,
    bank_balances: bankBalances,
    credit_card_bills: creditCardBills,
    top_expense_categories:  Object.values(catMap).sort((a, b) => b.amount - a.amount).slice(0, 5),
    goals: (goalsRes.data || []).map((g: any) => ({ name: g.name, target: Number(g.target_amount), current: Number(g.current_amount), icon: g.icon })),
    monthly_history: [],
    profiles: allProfiles || [{ name: profile.name }],
    savings,
    investments,
    total_patrimony: totalSaved + totalInvestValue,
  }
}
