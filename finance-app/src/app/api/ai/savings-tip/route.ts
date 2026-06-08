import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateSavingsInsight } from '@/lib/ai'
import { buildFinancialContext } from '@/lib/server/financial-context'

export const maxDuration = 30

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ tip: null }, { status: 401 })
    return NextResponse.json({ tip: generateSavingsInsight(await buildFinancialContext(supabase, user.id)) })
  } catch {
    return NextResponse.json({ tip: 'Nao consegui analisar a reserva agora. Confira os valores cadastrados e tente novamente.' })
  }
}
