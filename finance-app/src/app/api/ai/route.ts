import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30
import { createClient } from '@/lib/supabase/server'
import { chatWithFina, analyzePurchase } from '@/lib/ai'
import { AIContext, AIMessage } from '@/types'
import { format, startOfMonth, endOfMonth } from 'date-fns'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messages, mode, purchaseItem, purchasePrice } = await req.json()

    // Buscar contexto financeiro real do banco
    const context = await buildFinancialContext(supabase, user.id)

    // Modo análise de compra
    if (mode === 'purchase' && purchaseItem && purchasePrice) {
      const analysis = await analyzePurchase(purchaseItem, purchasePrice, context)
      return NextResponse.json({ response: analysis })
    }

    // Chat normal
    const response = await chatWithFina(messages as AIMessage[], context)
    return NextResponse.json({ response })

  } catch (error) {
    console.error('AI API error:', error)
    return NextResponse.json(
      { error: 'Erro interno. Tente novamente.' },
      { status: 500 }
    )
  }
}

// ============================================================
// Construir contexto financeiro do banco de dados
// ============================================================
async function buildFinancialContext(supabase: any, userId: string): Promise<AIContext> {
  const now = new Date()
  const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(now), 'yyyy-MM-dd')

  // Buscar perfis do household
  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id, name')
    .eq('id', userId)
    .single()

  if (!profile) throw new Error('Profile not found')

  const householdId = profile.household_id

  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('name')
    .eq('household_id', householdId)

  // Transações do mês atual com categoria
  const { data: currentMonthTx } = await supabase
    .from('transactions')
    .select('*, category:categories(name, icon)')
    .eq('household_id', householdId)
    .eq('status', 'realizado')
    .gte('date', monthStart)
    .lte('date', monthEnd)

  const income = (currentMonthTx || [])
    .filter((t: any) => t.type === 'receita')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0)

  const expenses = (currentMonthTx || [])
    .filter((t: any) => t.type === 'despesa' || t.type === 'fatura')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0)

  // Top categorias de despesa
  const categoryMap: Record<string, { name: string; icon: string; amount: number }> = {}
  for (const tx of (currentMonthTx || [])) {
    if (tx.type === 'despesa' && tx.category) {
      const key = tx.category.name
      if (!categoryMap[key]) categoryMap[key] = { name: key, icon: tx.category.icon, amount: 0 }
      categoryMap[key].amount += Number(tx.amount)
    }
  }
  const topCats = Object.values(categoryMap).sort((a, b) => b.amount - a.amount).slice(0, 5)

  // Histórico últimos 6 meses (simplificado)
  const { data: historyTx } = await supabase
    .from('transactions')
    .select('amount, type, month, year')
    .eq('household_id', householdId)
    .eq('status', 'realizado')
    .order('date', { ascending: false })
    .limit(500)

  const monthlyMap: Record<string, { income: number; expenses: number }> = {}
  for (const tx of (historyTx || [])) {
    const key = `${tx.month}/${tx.year}`
    if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expenses: 0 }
    if (tx.type === 'receita') monthlyMap[key].income += Number(tx.amount)
    else monthlyMap[key].expenses += Number(tx.amount)
  }
  const monthly_history = Object.entries(monthlyMap)
    .slice(0, 6)
    .map(([month, data]) => ({ month, ...data }))

  // Metas
  const { data: goals } = await supabase
    .from('goals')
    .select('name, target_amount, current_amount, icon')
    .eq('household_id', householdId)
    .eq('is_completed', false)

  return {
    current_month_income: income,
    current_month_expenses: expenses,
    current_month_balance: income - expenses,
    top_expense_categories: topCats,
    goals: (goals || []).map((g: any) => ({
      name: g.name,
      target: Number(g.target_amount),
      current: Number(g.current_amount),
      icon: g.icon,
    })),
    monthly_history,
    profiles: allProfiles || [{ name: profile.name }],
  }
}
