import { NextResponse } from 'next/server'

export const maxDuration = 30
import { createClient } from '@/lib/supabase/server'
import { generateDailyTip } from '@/lib/ai'
import { AIContext } from '@/types'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { NextRequest } from 'next/server'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ tip: null }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('household_id, name')
      .eq('id', user.id)
      .single()

    if (!profile?.household_id) return NextResponse.json({ tip: '💡 Cadastre seus primeiros lançamentos para receber dicas personalizadas!' })

    const hid = profile.household_id
    const params = req.nextUrl.searchParams
    const selectedMonth = Number(params.get('month')) || new Date().getMonth() + 1
    const selectedYear = Number(params.get('year')) || new Date().getFullYear()
    const selectedDate = new Date(selectedYear, selectedMonth - 1, 1)
    const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd')

    const [txRes, creditTxRes, banksRes, goalsRes, savingsRes, investRes] = await Promise.all([
      supabase
      .from('transactions')
      .select('*, category:categories(name, icon), bank:banks(*)')
      .eq('household_id', hid)
      .gte('date', start).lte('date', end),
      supabase
        .from('transactions')
        .select('*, category:categories(name, icon), bank:banks(*)')
        .eq('household_id', hid)
        .eq('status', 'realizado')
        .gte('date', format(startOfMonth(new Date(selectedYear, selectedMonth - 3, 1)), 'yyyy-MM-dd'))
        .lte('date', format(endOfMonth(new Date(selectedYear, selectedMonth, 1)), 'yyyy-MM-dd')),
      supabase.from('banks').select('*').eq('household_id', hid),
      supabase.from('goals').select('name,target_amount,current_amount,icon').eq('household_id', hid).eq('is_completed', false),
      supabase.from('savings').select('name,type,current_amount,interest_rate').eq('household_id', hid),
      supabase.from('investments').select('name,type,total_invested,current_price,quantity,avg_price').eq('household_id', hid),
    ])

    const txs = txRes.data || []
    const banks = banksRes.data || []
    const bankById = new Map<string, any>(banks.map((bank: any) => [bank.id, bank]))
    const isCreditTx = (tx: any) => bankById.get(tx.bank_id || '')?.type === 'credito'
    const isCoupleTx = (tx: any) => (tx.responsible_party || 'casal') === 'casal'
    const creditInvoiceTxs = (creditTxRes.data || []).filter((tx: any) => {
      const bank = bankById.get(tx.bank_id || '')
      if (!isCoupleTx(tx) || !bank || bank.type !== 'credito' || tx.type === 'receita') return false
      return isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), selectedDate)
    })
    const coupleTxs = txs.filter(isCoupleTx)
    const cashTxs = coupleTxs.filter((tx: any) => !isCreditTx(tx))
    const income = coupleTxs.filter((t: any) => t.type === 'receita' && t.status === 'realizado').reduce((s: number, t: any) => s + Number(t.amount), 0)
    const plannedIncome = coupleTxs.filter((t: any) => t.type === 'receita' && t.status !== 'realizado').reduce((s: number, t: any) => s + Number(t.amount), 0)
    const expenses = cashTxs.filter((t: any) => t.type !== 'receita' && t.status === 'realizado').reduce((s: number, t: any) => s + Number(t.amount), 0)
    const plannedExpenses = cashTxs.filter((t: any) => t.type !== 'receita' && t.status !== 'realizado').reduce((s: number, t: any) => s + Number(t.amount), 0)
      + creditInvoiceTxs.reduce((s: number, t: any) => s + Number(t.amount), 0)
    const bankBalances = banks.filter((bank: any) => bank.type !== 'credito').map((bank: any) => ({ name: bank.name, type: bank.type, balance: Number(bank.current_balance || 0) }))
    const projectedBalance = income + plannedIncome - expenses - plannedExpenses
    const catMap: Record<string, { name: string; icon: string; amount: number }> = {}
    for (const tx of [...cashTxs, ...creditInvoiceTxs] as any[]) {
      if (tx.type !== 'receita' && tx.category) {
        const key = tx.category.name
        if (!catMap[key]) catMap[key] = { name: key, icon: tx.category.icon, amount: 0 }
        catMap[key].amount += Number(tx.amount)
      }
    }
    const savings = (savingsRes.data || []).map((s: any) => ({
      name: s.name,
      type: s.type,
      amount: Number(s.current_amount),
      rate: s.interest_rate ? Number(s.interest_rate) : null,
    }))
    const investments = (investRes.data || []).map((i: any) => {
      const current = Number(i.quantity || 0) * Number(i.current_price || 0)
      return {
        name: i.name,
        type: i.type,
        invested: Number(i.total_invested || 0),
        current,
        pl: current - Number(i.total_invested || 0),
      }
    })
    const totalPatrimony = savings.reduce((sum: number, item: any) => sum + item.amount, 0)
      + investments.reduce((sum: number, item: any) => sum + item.current, 0)

    const context: AIContext = {
      current_month_income: income,
      current_month_expenses: expenses,
      current_month_balance: income - expenses,
      planned_month_income: plannedIncome,
      planned_month_expenses: plannedExpenses,
      projected_month_balance: projectedBalance,
      projected_cash_balance: bankBalances.reduce((s: number, b: any) => s + b.balance, 0) + projectedBalance,
      cash_balance: bankBalances.reduce((s: number, b: any) => s + b.balance, 0),
      bank_balances: bankBalances,
      credit_card_bills: banks
        .filter((bank: any) => bank.type === 'credito')
        .map((bank: any) => ({
          name: bank.name,
          due_day: bank.due_day,
          closing_day: bank.closing_day,
          amount: creditInvoiceTxs.filter((tx: any) => tx.bank_id === bank.id).reduce((s: number, tx: any) => s + Number(tx.amount), 0),
        }))
        .filter((bill: any) => bill.amount > 0),
      monthly_overview: [{
        month: String(selectedMonth).padStart(2, '0'),
        year: selectedYear,
        income,
        planned_income: plannedIncome,
        direct_expenses: expenses,
        planned_direct_expenses: plannedExpenses - creditInvoiceTxs.reduce((s: number, tx: any) => s + Number(tx.amount), 0),
        card_invoice: creditInvoiceTxs.reduce((s: number, tx: any) => s + Number(tx.amount), 0),
        projected_balance: projectedBalance,
      }],
      top_expense_categories: Object.values(catMap).sort((a, b) => b.amount - a.amount).slice(0, 5),
      goals: (goalsRes.data || []).map((g: any) => ({ name: g.name, target: Number(g.target_amount), current: Number(g.current_amount), icon: g.icon })),
      monthly_history: [],
      profiles: [{ name: profile.name }],
      savings,
      investments,
      total_patrimony: totalPatrimony,
    }

    const tip = await generateDailyTip(context)
    return NextResponse.json({ tip })
  } catch {
    return NextResponse.json({ tip: '💡 Lance suas receitas e despesas para receber insights personalizados!' })
  }
}
