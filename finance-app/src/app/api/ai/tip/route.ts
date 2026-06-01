import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDailyTip } from '@/lib/ai'
import { buildFinancialContext } from '@/lib/server/financial-context'

export const maxDuration = 30

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ tip: null }, { status: 401 })

    const params = req.nextUrl.searchParams
    const selectedMonth = Number(params.get('month')) || new Date().getMonth() + 1
    const selectedYear = Number(params.get('year')) || new Date().getFullYear()
    const context = await buildFinancialContext(supabase, user.id, new Date(selectedYear, selectedMonth - 1, 1))

    return NextResponse.json({ tip: await generateDailyTip(context) })
  } catch {
    return NextResponse.json({ tip: 'Lance suas receitas e despesas para receber insights personalizados.' })
  }
}
