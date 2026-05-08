'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type Mode = 'login' | 'invite' | 'mfa'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<Mode>('login')
  const [name, setName] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaFactorId, setMfaFactorId] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const goHome = () => {
    router.push('/')
    router.refresh()
  }

  const prepareMfaChallenge = async () => {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors()
    if (factorsError) throw factorsError
    const factor = factors.totp.find(item => item.status === 'verified')
    if (!factor) {
      toast.error('MFA esta ativo, mas nenhum fator verificado foi encontrado.')
      return false
    }
    setMfaFactorId(factor.id)
    setMode('mfa')
    return true
  }

  const finishPasswordLogin = async () => {
    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalError) throw aalError

    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      const prepared = await prepareMfaChallenge()
      if (prepared) toast.message('Digite o codigo do seu autenticador para continuar.')
      return
    }

    goHome()
  }

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('invite') === '1') {
        setMode('invite')
        const invitedEmail = params.get('email')
        if (invitedEmail) setEmail(invitedEmail)
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        await prepareMfaChallenge()
      }
    }
    init()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        await finishPasswordLogin()
      } else if (mode === 'invite') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        })
        if (error) throw error
        toast.success('Conta criada pelo convite. Verifique seu email se a confirmacao estiver ativa.')
        setMode('login')
      } else {
        if (!mfaFactorId) throw new Error('Fator MFA nao encontrado. Entre novamente.')
        const { error } = await supabase.auth.mfa.challengeAndVerify({
          factorId: mfaFactorId,
          code: mfaCode.replace(/\s/g, ''),
        })
        if (error) throw error
        goHome()
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const title =
    mode === 'login' ? 'Bem-vindo(a) de volta!' :
    mode === 'invite' ? 'Criar conta convidada' :
    'Confirmar MFA'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#08080F]">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/login/login-bg-mobile.png')" }}
      />
      <div
        className="absolute inset-0 hidden md:block bg-cover bg-center"
        style={{ backgroundImage: "url('/login/login-bg-desktop.png')" }}
      />
      <div className="absolute inset-0 bg-black/35 md:bg-black/30" />

      <div className="w-full max-w-sm relative z-10">
        <div className="rounded-3xl p-5 sm:p-6 shadow-float backdrop-blur-2xl" style={{ background: 'rgba(13,13,26,0.82)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 24px 80px rgba(0,0,0,0.38)' }}>
          <div className="text-center mb-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-float overflow-hidden bg-white/10 border border-white/20">
            <img src="/icons/icon-512.png" alt="Financas do Casal" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-bold text-white">Financas do Casal</h1>
            <p className="text-white/75 text-sm mt-1">{title}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'invite' && (
              <div>
                <label className="text-xs font-medium text-white/70 mb-1 block">Seu nome</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Jonatas ou Thuany"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
            )}

            {mode !== 'mfa' ? (
              <>
                <div>
                  <label className="text-xs font-medium text-white/70 mb-1 block">Email</label>
                  <input
                    className="input"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-white/70 mb-1 block">Senha</label>
                  <input
                    className="input"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs font-medium text-white/70 mb-1 block">Codigo do autenticador</label>
                <input
                  className="input text-center tracking-widest"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Aguarde...
                </>
              ) : (
                mode === 'login' ? 'Entrar' : mode === 'invite' ? 'Criar conta' : 'Verificar codigo'
              )}
            </button>
          </form>

          {mode === 'invite' && (
            <div className="mt-4 pt-4 border-t border-white/10 text-center">
              <button
                onClick={() => setMode('login')}
                className="text-sm font-medium hover:underline"
                style={{ color: '#F1F5F9' }}
              >
                Ja tenho conta
              </button>
            </div>
          )}

          <p className="text-center text-xs text-white/55 mt-5">
            Cadastro somente por convite do admin.
          </p>
        </div>
      </div>
    </div>
  )
}
