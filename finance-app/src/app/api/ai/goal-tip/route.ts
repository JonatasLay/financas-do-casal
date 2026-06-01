import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateGoalInsight } from '@/lib/ai'
import { buildFinancialContext } from '@/lib/server/financial-context'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const goalId = req.nextUrl.searchParams.get('goalId')
    if (!goalId) return NextResponse.json({ tip: null }, { status: 400 })
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ tip: null }, { status: 401 })
    const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', user.id).single()
    if (!profile?.household_id) return NextResponse.json({ tip: null }, { status: 401 })
    const { data: goal } = await supabase.from('goals').select('*').eq('id', goalId).eq('household_id', profile.household_id).single()
    if (!goal) return NextResponse.json({ tip: null }, { status: 404 })

    return NextResponse.json({
      tip: await generateGoalInsight(await buildFinancialContext(supabase, user.id), {
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
