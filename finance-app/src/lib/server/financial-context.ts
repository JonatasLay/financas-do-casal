import { addMonths, endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from 'date-fns'
import { calculateAccumulatedCashForecast, calculateMonthProjection, getEffectiveCashDate, getHouseholdNetAmount, isCoupleTransaction } from '@/lib/finance-summary'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'
import type { AIContext, Bank, Transaction } from '@/types'

export async function buildFinancialContext(supabase: any, userId: string, selectedDate = new Date()): Promise<AIContext> {
  const now = new Date()
  const selectedYearStart = startOfMonth(subMonths(startOfYear(selectedDate), 2))
  const currentForecastStart = startOfMonth(subMonths(now, 2))
  const queryStart = format(selectedYearStart < currentForecastStart ? selectedYearStart : currentForecastStart, 'yyyy-MM-dd')
  const queryEnd = format(endOfMonth(addMonths(endOfYear(selectedDate), 1)), 'yyyy-MM-dd')

  const { data: profile } = await supabase.from('profiles').select('household_id, name').eq('id', userId).single()
  if (!profile?.household_id) throw new Error('Profile not found')
  const hid = profile.household_id

  const [profilesRes, txRes, goalsRes, savingsRes, investRes, banksRes, recentTxRes, finaProfileRes] = await Promise.all([
    supabase.from('profiles').select('name').eq('household_id', hid),
    supabase.from('transactions').select('*, category:categories(name,icon), bank:banks(*)').eq('household_id', hid).gte('date', queryStart).lte('date', queryEnd),
    supabase.from('goals').select('name,target_amount,current_amount,icon').eq('household_id', hid).eq('is_completed', false),
    supabase.from('savings').select('name,type,current_amount,interest_rate').eq('household_id', hid),
    supabase.from('investments').select('name,type,total_invested,current_price,quantity,avg_price').eq('household_id', hid),
    supabase.from('banks').select('*').eq('household_id', hid),
    supabase.from('transactions').select('id,date,description,amount,type,status,responsible_party,category:categories(name),bank:banks(name)').eq('household_id', hid).order('date', { ascending: false }).limit(30),
    supabase.from('fina_financial_profiles').select('profile_summary').eq('household_id', hid).maybeSingle(),
  ])

  const transactions = (txRes.data || []) as Transaction[]
  const banks = (banksRes.data || []) as Bank[]
  const selected = calculateMonthProjection(transactions, banks, selectedDate)
  const cashForecast = calculateAccumulatedCashForecast(transactions, banks, selectedDate, now)
  const bankBalances = banks
    .filter(bank => bank.type !== 'credito')
    .map(bank => ({ name: bank.name, type: bank.type, balance: Number(bank.current_balance || 0) }))
  const savings = (savingsRes.data || []).map((item: any) => ({
    name: item.name,
    type: item.type,
    amount: Number(item.current_amount),
    rate: item.interest_rate ? Number(item.interest_rate) : null,
  }))
  const investments = (investRes.data || []).map((item: any) => {
    const current = Number(item.quantity || 0) * Number(item.current_price || 0)
    const invested = Number(item.total_invested || 0)
    return { name: item.name, type: item.type, invested, current, pl: current - invested }
  })
  const bankById = new Map(banks.map(bank => [bank.id, bank]))
  const monthDirectRows = transactions.filter(tx => {
    const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd')
    const effectiveDate = getEffectiveCashDate(tx)
    return effectiveDate >= start
      && effectiveDate <= end
      && isCoupleTransaction(tx)
      && bankById.get(tx.bank_id || '')?.type !== 'credito'
  })
  const monthCardRows = transactions.filter(tx => {
    const bank = bankById.get(tx.bank_id || '')
    return isCoupleTransaction(tx)
      && bank?.type === 'credito'
      && tx.type !== 'receita'
      && tx.status === 'realizado'
      && isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), selectedDate)
  })
  const categoryTotals: Record<string, { name: string; icon: string; amount: number }> = {}
  for (const tx of [...monthDirectRows, ...monthCardRows]) {
    if (tx.type === 'receita' || !tx.category) continue
    const key = tx.category.name
    if (!categoryTotals[key]) categoryTotals[key] = { name: key, icon: tx.category.icon, amount: 0 }
    categoryTotals[key].amount += isCoupleTransaction(tx) ? getHouseholdNetAmount(tx) : Number(tx.amount)
  }
  const monthlyOverview = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(selectedDate.getFullYear(), index, 1)
    const projection = calculateMonthProjection(transactions, banks, monthDate)
    return {
      month: format(monthDate, 'MM'),
      year: monthDate.getFullYear(),
      income: projection.realizedIncome,
      planned_income: projection.plannedIncome,
      direct_expenses: projection.realizedDirectExpenses,
      planned_direct_expenses: projection.plannedDirectExpenses,
      card_invoice: projection.cardInvoice,
      projected_balance: projection.householdResult,
    }
  })
  const creditCardBills = banks
    .filter(bank => bank.type === 'credito')
    .map(bank => ({
      name: bank.name,
      due_day: bank.due_day || null,
      closing_day: bank.closing_day || null,
      amount: transactions
        .filter(tx => tx.bank_id === bank.id && isCoupleTransaction(tx))
        .filter(tx => {
          const projection = calculateMonthProjection([tx], [bank], selectedDate)
          return projection.cardInvoice > 0
        })
        .reduce((sum, tx) => sum + getHouseholdNetAmount(tx), 0),
    }))
    .filter(bill => bill.amount > 0)
  const recentTransactions = (recentTxRes.data || [])
    .filter((tx: Transaction) => isCoupleTransaction(tx))
    .slice(0, 20)
    .map((tx: any) => ({
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: Number(tx.amount),
      type: tx.type,
      status: tx.status,
      bank: tx.bank?.name || null,
      category: tx.category?.name || null,
    }))

  return {
    current_month_income: selected.realizedIncome,
    current_month_expenses: selected.realizedDirectExpenses,
    current_month_balance: selected.realizedOperationalIncome - selected.realizedDirectExpenses,
    planned_month_income: selected.plannedOperationalIncome,
    planned_month_expenses: selected.plannedDirectExpenses + selected.cardInvoice,
    projected_month_balance: selected.householdResult,
    projected_cash_balance: cashForecast.projectedCashBalance,
    cash_balance: cashForecast.cashBalance,
    bank_balances: bankBalances,
    credit_card_bills: creditCardBills,
    monthly_overview: monthlyOverview,
    recent_transactions: recentTransactions,
    top_expense_categories: Object.values(categoryTotals).sort((a, b) => b.amount - a.amount).slice(0, 5),
    goals: (goalsRes.data || []).map((goal: any) => ({ name: goal.name, target: Number(goal.target_amount), current: Number(goal.current_amount), icon: goal.icon })),
    monthly_history: [],
    profiles: profilesRes.data || [{ name: profile.name }],
    savings,
    investments,
    total_patrimony: savings.reduce((sum: number, item: any) => sum + item.amount, 0)
      + investments.reduce((sum: number, item: any) => sum + item.current, 0),
    fina_memory: finaProfileRes.data?.profile_summary || '',
  }
}
