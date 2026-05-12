'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ShieldCheck, UserPlus, Mail, X, Crown, KeyRound } from 'lucide-react'
import type { HouseholdInvite, Profile } from '@/types'

const textStyle = { color: '#F1F5F9' } as const
const labelStyle = { color: '#64748B' } as const

function brDate(value: string) {
  return new Date(value).toLocaleDateString('pt-BR')
}

function inviteUrl(email: string) {
  if (typeof window === 'undefined') return `/login?invite=1&email=${encodeURIComponent(email)}`
  return `${window.location.origin}/login?invite=1&email=${encodeURIComponent(email)}`
}

export function UserAdminTab({ profile }: { profile: Profile | null }) {
  const supabase = createClient()
  const [members, setMembers] = useState<Profile[]>([])
  const [invites, setInvites] = useState<HouseholdInvite[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resettingMfaId, setResettingMfaId] = useState('')

  const isAdmin = profile?.role === 'admin'

  const load = useCallback(async () => {
    if (!profile?.household_id) return
    setLoading(true)
    const [membersRes, invitesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('household_id', profile.household_id).order('created_at'),
      isAdmin
        ? supabase.from('household_invites').select('*').eq('household_id', profile.household_id).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as HouseholdInvite[] }),
    ])
    setMembers((membersRes.data || []) as Profile[])
    setInvites((invitesRes.data || []) as HouseholdInvite[])
    setLoading(false)
  }, [profile?.household_id, isAdmin])

  useEffect(() => { load() }, [load])

  const invite = async () => {
    if (!profile?.household_id || !profile.id) return
    if (!email.trim()) return void toast.error('Informe o email do convite')
    const normalizedEmail = email.trim().toLowerCase()
    setSaving(true)
    const { error } = await supabase.from('household_invites').upsert({
      household_id: profile.household_id,
      email: normalizedEmail,
      role,
      status: 'pending',
      invited_by: profile.id,
    }, { onConflict: 'household_id,email' })
    if (error) {
      setSaving(false)
      return void toast.error(error.message || 'Erro ao criar convite')
    }

    const attach = await supabase.rpc('admin_attach_existing_user', {
      target_email: normalizedEmail,
      target_role: role,
    })
    setSaving(false)
    if (!attach.error && attach.data === true) {
      toast.success('Usuario existente vinculado ao mesmo painel.')
    } else {
      toast.success('Convite criado. A pessoa ja pode criar conta com esse email.')
    }
    setEmail('')
    setRole('member')
    load()
  }

  const resetMfa = async (member: Profile) => {
    const confirmed = window.confirm(`Resetar MFA de ${member.name}? A pessoa precisara configurar o autenticador novamente.`)
    if (!confirmed) return
    setResettingMfaId(member.id)
    const res = await fetch('/api/admin/mfa/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: member.id }),
    })
    const data = await res.json().catch(() => ({}))
    setResettingMfaId('')
    if (!res.ok) return void toast.error(data.error || 'Erro ao resetar MFA')
    toast.success(data.removed > 0 ? 'MFA resetado com sucesso' : 'Nenhum MFA cadastrado para esse usuario')
  }

  const updateRole = async (member: Profile, nextRole: 'admin' | 'member') => {
    if (member.id === profile?.id && nextRole !== 'admin') {
      const adminCount = members.filter(item => item.role === 'admin').length
      if (adminCount <= 1) return void toast.error('Mantenha pelo menos um admin no casal')
    }
    const { error } = await supabase.from('profiles').update({ role: nextRole }).eq('id', member.id)
    if (error) return void toast.error(error.message || 'Erro ao atualizar permissao')
    toast.success('Permissao atualizada')
    load()
  }

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from('household_invites').update({ status: 'revoked' }).eq('id', inviteId)
    if (error) return void toast.error(error.message || 'Erro ao revogar convite')
    toast.success('Convite revogado')
    load()
  }

  const copyInviteLink = async (email: string) => {
    const link = inviteUrl(email)
    await navigator.clipboard.writeText(link)
    toast.success('Link de convite copiado')
  }

  if (!isAdmin) {
    return (
      <div className="card max-w-xl">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4" style={{ color: '#FBBF24' }} />
          <p className="font-semibold text-sm" style={textStyle}>Acesso de admin</p>
        </div>
        <p className="text-sm" style={labelStyle}>
          Esta area e exclusiva para administradores. Um admin pode criar convites e alterar papeis dos membros.
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4" style={{ color: '#818CF8' }} />
          <p className="font-semibold text-sm" style={textStyle}>Convidar ou vincular usuario</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={labelStyle}>Email</p>
          <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="thuany@email.com" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={labelStyle}>Papel inicial</p>
          <div className="grid grid-cols-2 gap-2">
            {(['member', 'admin'] as const).map(item => (
              <button key={item} type="button" onClick={() => setRole(item)}
                className="py-2 rounded-xl text-sm font-medium border transition-all"
                style={role === item
                  ? { borderColor: '#818CF8', background: 'rgba(129,140,248,0.14)', color: '#818CF8' }
                  : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8' }}>
                {item === 'admin' ? 'Admin' : 'Membro'}
              </button>
            ))}
          </div>
        </div>
        <button onClick={invite} disabled={saving} className="btn-primary w-full">
          {saving ? 'Processando...' : 'Vincular / criar convite'}
        </button>
        <p className="text-[11px]" style={{ color: '#475569' }}>
          Se a conta ja existir, ela sera vinculada ao seu painel. Se nao existir, fica um convite pendente para esse email.
        </p>
      </div>

      <div className="space-y-4">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4" style={{ color: '#34D399' }} />
            <p className="font-semibold text-sm" style={textStyle}>Membros</p>
          </div>
          <div className="space-y-2">
            {loading ? <div className="skeleton h-16 rounded-xl" /> : members.map(member => (
              <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0 overflow-hidden ring-1 ring-white/10"
                  style={{ backgroundColor: member.avatar_color }}>
                  {member.avatar_url ? <img src={member.avatar_url} alt={member.name} className="block w-full h-full rounded-full object-cover" /> : member.avatar_emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={textStyle}>{member.name}</p>
                  <p className="text-[10px] truncate" style={{ color: '#64748B' }}>{member.email || 'email nao sincronizado'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => resetMfa(member)}
                    disabled={resettingMfaId === member.id}
                    className="p-2 rounded-lg transition-colors disabled:opacity-40"
                    style={{ color: '#FBBF24', background: 'rgba(251,191,36,0.08)' }}
                    title="Resetar MFA"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>
                  <select
                    value={member.role || 'member'}
                    onChange={e => updateRole(member, e.target.value as 'admin' | 'member')}
                    className="rounded-xl px-2 py-1.5 text-xs outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#F1F5F9' }}
                  >
                    <option value="member">Membro</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-4 h-4" style={{ color: '#22D3EE' }} />
            <p className="font-semibold text-sm" style={textStyle}>Convites</p>
          </div>
          <div className="space-y-2">
            {invites.length === 0 && <p className="text-sm text-center py-4" style={{ color: '#475569' }}>Nenhum convite ainda</p>}
            {invites.map(inviteItem => (
              <div key={inviteItem.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={textStyle}>{inviteItem.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {inviteItem.role === 'admin' && <Crown className="w-3 h-3" style={{ color: '#FBBF24' }} />}
                    <span className="text-[10px]" style={{ color: '#64748B' }}>{inviteItem.role === 'admin' ? 'Admin' : 'Membro'} · {brDate(inviteItem.created_at)}</span>
                    <span className="text-[10px]" style={{ color: inviteItem.status === 'pending' ? '#FBBF24' : inviteItem.status === 'accepted' ? '#34D399' : '#F87171' }}>
                      {inviteItem.status}
                    </span>
                  </div>
                </div>
                {inviteItem.status === 'pending' && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => copyInviteLink(inviteItem.email)}
                      className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                      style={{ color: '#22D3EE', background: 'rgba(34,211,238,0.08)' }}>
                      Copiar link
                    </button>
                    <button onClick={() => revokeInvite(inviteItem.id)}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: '#F87171', background: 'rgba(248,113,113,0.08)' }}
                      title="Revogar convite">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
