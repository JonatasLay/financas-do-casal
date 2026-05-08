'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { KeyRound, ShieldCheck, ShieldAlert, Trash2 } from 'lucide-react'

const textStyle = { color: '#F1F5F9' } as const
const labelStyle = { color: '#64748B' } as const

type TotpFactor = { id: string; friendly_name?: string; status: string; created_at?: string }

export function SecurityTab() {
  const supabase = createClient()
  const [factors, setFactors] = useState<TotpFactor[]>([])
  const [aal, setAal] = useState<{ currentLevel?: string | null; nextLevel?: string | null }>({})
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [factorRes, aalRes] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])
    if (!factorRes.error) setFactors(factorRes.data.totp as TotpFactor[])
    if (!aalRes.error) setAal(aalRes.data || {})
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const startEnroll = async () => {
    setEnrolling(true)
    setCode('')
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Financas do Casal',
      issuer: 'Financas do Casal',
    })
    if (error) {
      setEnrolling(false)
      return void toast.error(error.message || 'Erro ao iniciar MFA')
    }

    const challenge = await supabase.auth.mfa.challenge({ factorId: data.id })
    if (challenge.error) {
      setEnrolling(false)
      return void toast.error(challenge.error.message || 'Erro ao gerar desafio MFA')
    }

    setFactorId(data.id)
    setChallengeId(challenge.data.id)
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
    setEnrolling(false)
  }

  const verifyEnroll = async () => {
    if (!factorId || !challengeId) return
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId,
      code: code.replace(/\s/g, ''),
    })
    if (error) return void toast.error(error.message || 'Codigo invalido')
    toast.success('MFA ativado com sucesso')
    setFactorId('')
    setChallengeId('')
    setQrCode('')
    setSecret('')
    setCode('')
    load()
  }

  const removeFactor = async (id: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
    if (error) return void toast.error(error.message || 'Erro ao remover MFA')
    toast.success('Fator MFA removido')
    load()
  }

  const hasVerifiedFactor = factors.some(f => f.status === 'verified')
  const qrMarkup = qrCode.trim().startsWith('<svg') ? qrCode : ''
  const qrSrc = qrCode && !qrMarkup
    ? (qrCode.startsWith('data:image') ? qrCode : `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`)
    : ''

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          {hasVerifiedFactor ? <ShieldCheck className="w-4 h-4" style={{ color: '#34D399' }} /> : <ShieldAlert className="w-4 h-4" style={{ color: '#FBBF24' }} />}
          <p className="font-semibold text-sm" style={textStyle}>MFA / Autenticador</p>
        </div>
        <p className="text-sm" style={labelStyle}>
          Use um app autenticador para exigir um codigo extra depois da senha.
        </p>
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p className="text-xs" style={labelStyle}>Sessao atual</p>
          <p className="text-sm font-semibold mt-1" style={textStyle}>
            {aal.currentLevel === 'aal2' ? 'Verificada com MFA' : 'Senha verificada'}
          </p>
          {aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2' && (
            <p className="text-xs mt-1" style={{ color: '#FBBF24' }}>Entre novamente para elevar esta sessao com MFA.</p>
          )}
        </div>

        {!qrCode && (
          <button onClick={startEnroll} disabled={enrolling} className="btn-primary w-full">
            {enrolling ? 'Preparando...' : hasVerifiedFactor ? 'Adicionar outro fator' : 'Ativar MFA'}
          </button>
        )}

        {qrCode && (
          <div className="space-y-3">
            <div className="flex justify-center rounded-2xl p-4 min-h-56 items-center" style={{ background: '#fff' }}>
              {qrMarkup ? (
                <div
                  className="w-48 h-48 [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: qrMarkup }}
                  aria-label="QR Code MFA"
                />
              ) : (
                <img src={qrSrc} alt="QR Code MFA" className="w-48 h-48" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={labelStyle}>Chave manual</p>
              <input className="input font-mono text-xs" readOnly value={secret} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={labelStyle}>Codigo de 6 digitos</p>
              <input
                className="input text-center tracking-widest"
                inputMode="numeric"
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="000000"
              />
            </div>
            <button onClick={verifyEnroll} disabled={code.replace(/\s/g, '').length < 6} className="btn-primary w-full disabled:opacity-40">
              Confirmar e ativar
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4" style={{ color: '#818CF8' }} />
          <p className="font-semibold text-sm" style={textStyle}>Fatores cadastrados</p>
        </div>
        <div className="space-y-2">
          {loading ? <div className="skeleton h-14 rounded-xl" /> : factors.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: '#475569' }}>Nenhum fator MFA cadastrado</p>
          )}
          {factors.map(factor => (
            <div key={factor.id} className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex-1">
                <p className="text-sm font-medium" style={textStyle}>{factor.friendly_name || 'Autenticador'}</p>
                <p className="text-[10px]" style={{ color: factor.status === 'verified' ? '#34D399' : '#FBBF24' }}>{factor.status}</p>
              </div>
              <button onClick={() => removeFactor(factor.id)}
                className="p-2 rounded-lg transition-colors"
                style={{ color: '#F87171', background: 'rgba(248,113,113,0.08)' }}
                title="Remover fator">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
