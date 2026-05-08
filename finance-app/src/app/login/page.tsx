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
    mode === 'invite' ? 'Criar conta com convite' :
    'Confirmar MFA'

  return (
    <div className="min-h-screen bg-gradient-app flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-card rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-float">
            <span className="text-3xl">💜</span>
          </div>
          <h1 className="text-2xl font-bold text-gradient">Finanças do Casal</h1>
          <p className="text-gray-500 text-sm mt-1">{title}</p>
        </div>

        <div className="card shadow-float">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'invite' && (
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Seu nome</label>
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
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
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
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Senha</label>
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
                <label className="text-xs font-medium text-gray-600 mb-1 block">Codigo do autenticador</label>
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
                mode === 'login' ? 'Entrar' : mode === 'invite' ? 'Criar com convite' : 'Verificar codigo'
              )}
            </button>
          </form>

          {mode !== 'mfa' && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                {mode === 'login' ? 'Recebeu um convite?' : 'Ja tem conta?'}{' '}
                <button
                  onClick={() => setMode(mode === 'login' ? 'invite' : 'login')}
                  className="text-primary-600 font-medium hover:underline"
                >
                  {mode === 'login' ? 'Criar conta convidada' : 'Entrar'}
                </button>
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Cadastro protegido por convite e MFA opcional.
        </p>
      </div>
    </div>
  )
}
