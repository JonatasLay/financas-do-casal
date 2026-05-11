import { NextResponse } from 'next/server'

export const maxDuration = 30
import { createClient } from '@/lib/supabase/server'
import { generateDailyTip } from '@/lib/ai'
import { AIContext } from '@/types'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { NextRequest } from 'next/server'

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

    const { data: txs } = await supabase
      .from('transactions')
      .select('amount, type, status, category:categories(name, icon)')
      .eq('household_id', hid)
      .gte('date', start).lte('date', end)

    const income = (txs || []).filter(t => t.type === 'receita' && t.status === 'realizado').reduce((s, t) => s + Number(t.amount), 0)
    const plannedIncome = (txs || []).filter(t => t.type === 'receita' && t.status !== 'realizado').reduce((s, t) => s + Number(t.amount), 0)
    const expenses = (txs || []).filter(t => t.type !== 'receita' && t.status === 'realizado').reduce((s, t) => s + Number(t.amount), 0)
    const plannedExpenses = (txs || []).filter(t => t.type !== 'receita' && t.status !== 'realizado').reduce((s, t) => s + Number(t.amount), 0)

    const context: AIContext = {
      current_month_income: income,
      current_month_expenses: expenses,
      current_month_balance: income - expenses,
      planned_month_income: plannedIncome,
      planned_month_expenses: plannedExpenses,
      projected_month_balance: income + plannedIncome - expenses - plannedExpenses,
      top_expense_categories: [],
      goals: [],
      monthly_history: [],
      profiles: [{ name: profile.name }],
    }

    const tip = await generateDailyTip(context)
    return NextResponse.json({ tip })
  } catch {
    return NextResponse.json({ tip: '💡 Lance suas receitas e despesas para receber insights personalizados!' })
  }
}
