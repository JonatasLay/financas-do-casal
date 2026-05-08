'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/')
        router.refresh()
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        })
        if (error) throw error

        // Criar household para o primeiro usuário
        if (data.user) {
          const { data: hh } = await supabase
            .from('households')
            .insert({ name: 'Nossa Família' })
            .select()
            .single()

          if (hh) {
            await supabase
              .from('profiles')
              .update({ household_id: hh.id })
              .eq('id', data.user.id)
          }
        }

        toast.success('Conta criada! Verifique seu email para confirmar.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-app flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-card rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-float">
            <span className="text-3xl">💜</span>
          </div>
          <h1 className="text-2xl font-bold text-gradient">Finanças do Casal</h1>
          <p className="text-gray-500 text-sm mt-1">
            {mode === 'login' ? 'Bem-vindo(a) de volta!' : 'Vamos começar juntos!'}
          </p>
        </div>

        {/* Card */}
        <div className="card shadow-float">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
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
                mode === 'login' ? '✨ Entrar' : '🚀 Criar conta'
              )}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              {mode === 'login' ? 'Novo por aqui?' : 'Já tem conta?'}{' '}
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-primary-600 font-medium hover:underline"
              >
                {mode === 'login' ? 'Criar conta' : 'Entrar'}
              </button>
            </p>
          </div>
        </div>

        {/* Info sobre compartilhamento */}
        {mode === 'signup' && (
          <div className="mt-4 p-3 bg-primary-50 rounded-xl border border-primary-100 text-xs text-primary-700 text-center">
            💡 Após criar sua conta, você poderá convidar seu cônjuge para compartilharem o mesmo painel em tempo real!
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          Seus dados são privados e seguros 🔒
        </p>
      </div>
    </div>
  )
}
