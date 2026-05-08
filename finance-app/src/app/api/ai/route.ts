import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

import { createClient } from '@/lib/supabase/server'
import { chatWithFina, analyzePurchase, analyzeInvestments } from '@/lib/ai'
import { AIContext, AIMessage } from '@/types'
import { format, startOfMonth, endOfMonth } from 'date-fns'

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

  const { data: profile } = await supabase.from('profiles').select('household_id, name').eq('id', userId).single()
  if (!profile) throw new Error('Profile not found')

  const hid = profile.household_id
  const { data: allProfiles } = await supabase.from('profiles').select('name').eq('household_id', hid)

  const [txRes, goalsRes, savingsRes, investRes] = await Promise.all([
    supabase.from('transactions').select('*, category:categories(name,icon)').eq('household_id', hid).eq('status','realizado').gte('date',start).lte('date',end),
    supabase.from('goals').select('name,target_amount,current_amount,icon').eq('household_id', hid).eq('is_completed', false),
    supabase.from('savings').select('name,type,current_amount,interest_rate').eq('household_id', hid),
    supabase.from('investments').select('name,type,total_invested,current_price,quantity,avg_price').eq('household_id', hid),
  ])

  const txs      = txRes.data || []
  const income   = txs.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0)
  const expenses = txs.filter((t: any) => t.type !== 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0)

  const catMap: Record<string, { name: string; icon: string; amount: number }> = {}
  for (const tx of txs as any[]) {
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

  return {
    current_month_income:    income,
    current_month_expenses:  expenses,
    current_month_balance:   income - expenses,
    top_expense_categories:  Object.values(catMap).sort((a, b) => b.amount - a.amount).slice(0, 5),
    goals: (goalsRes.data || []).map((g: any) => ({ name: g.name, target: Number(g.target_amount), current: Number(g.current_amount), icon: g.icon })),
    monthly_history: [],
    profiles: allProfiles || [{ name: profile.name }],
    savings,
    investments,
    total_patrimony: totalSaved + totalInvestValue,
  }
}
