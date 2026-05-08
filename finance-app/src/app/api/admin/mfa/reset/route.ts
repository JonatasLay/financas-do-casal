import { NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { createClient as createAdminSupabase } from '@supabase/supabase-js'

export async function POST(request: Request) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetUserId } = await request.json()
  if (!targetUserId || typeof targetUserId !== 'string') {
    return NextResponse.json({ error: 'targetUserId obrigatorio' }, { status: 400 })
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('id, household_id, role')
    .eq('id', user.id)
    .single()

  if (!adminProfile?.household_id || adminProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas admins podem resetar MFA' }, { status: 403 })
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, household_id')
    .eq('id', targetUserId)
    .single()

  if (!targetProfile || targetProfile.household_id !== adminProfile.household_id) {
    return NextResponse.json({ error: 'Usuario fora do household' }, { status: 403 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY nao configurada no servidor' }, { status: 500 })
  }

  const admin = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )

  const { data: factorData, error: listError } = await admin.auth.admin.mfa.listFactors({
    userId: targetUserId,
  })

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 })
  }

  const factors = factorData?.factors || []
  for (const factor of factors) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({
      userId: targetUserId,
      id: factor.id,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ removed: factors.length })
}
