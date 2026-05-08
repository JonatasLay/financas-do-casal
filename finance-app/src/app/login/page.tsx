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
    <div className="min-h-screen flex items-center justify-center px-4 py-6 md:p-6 relative overflow-hidden bg-[#08080F]">
      <div
        className="absolute inset-0 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/login/login-bg-mobile.png')" }}
      />
      <div
        className="absolute inset-0 hidden md:block bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/login/login-bg-desktop.png')" }}
      />
      <div className="absolute inset-0 bg-black/18 md:bg-black/16" />

      <div className="w-full max-w-[620px] relative z-10 mt-[31vh] md:mt-36">
        <div
          className="rounded-3xl p-4 md:p-5 shadow-float backdrop-blur-2xl"
          style={{
            background: 'rgba(13,13,26,0.78)',
            border: '1px solid rgba(255,255,255,0.16)',
            boxShadow: '0 22px 70px rgba(0,0,0,0.36)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 md:gap-5 items-center">
            <div className="flex md:flex-col items-center justify-center gap-3 md:gap-2 text-center">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shadow-float overflow-hidden bg-white/10 border border-white/20 flex-shrink-0">
                <img src="/icons/icon-512.png" alt="Financas do Casal" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-[22px] font-bold text-white leading-tight">Financas do Casal</h1>
                <p className="text-white/75 text-xs md:text-sm mt-0.5">{title}</p>
              </div>
            </div>

            <div>
              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'invite' && (
                  <div>
                    <label className="text-xs font-medium text-white/70 mb-1 block">Seu nome</label>
                    <input
                      className="input h-11"
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
                        className="input h-11"
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
                        className="input h-11"
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
                      className="input h-11 text-center tracking-widest"
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
                  className="btn-primary w-full h-11 flex items-center justify-center gap-2 mt-1"
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
                <div className="mt-3 pt-3 border-t border-white/10 text-center">
                  <button
                    onClick={() => setMode('login')}
                    className="text-sm font-medium hover:underline"
                    style={{ color: '#F1F5F9' }}
                  >
                    Ja tenho conta
                  </button>
                </div>
              )}

              <p className="text-center text-xs text-white/55 mt-3">
                Cadastro somente por convite do admin.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
