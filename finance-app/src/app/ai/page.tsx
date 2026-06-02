'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { createClient } from '@/lib/supabase/client'
import { Bot, Brain, CircleDollarSign, Eraser, Landmark, PiggyBank, Send, Sparkles, Target, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import type { AIMessage } from '@/types'

const visibleMessage = (content: string) => content.replace(/\[(?:CONFIRMAR_LANCAMENTO|EXCLUIR_ID:[^\]]+)\]\n?/g, '')
const chatStorageKey = (userId: string) => `fina-chat:${userId}`

const QUICK_PROMPTS = [
  { icon: WalletCards, label: 'Planejar o mês', text: 'Analise nosso mês atual por completo e me diga as três ações mais importantes para melhorar nosso caixa.' },
  { icon: CircleDollarSign, label: 'Avaliar compra', text: 'Quero avaliar uma compra. Me pergunte o item, o valor e quando pretendo comprar.' },
  { icon: PiggyBank, label: 'Revisar reserva', text: 'Analise nossa reserva de emergência e diga qual deve ser nosso próximo passo.' },
  { icon: Target, label: 'Avançar metas', text: 'Revise nossas metas e proponha um plano realista para avançarmos sem comprometer o caixa.' },
]

function initialMessage(name?: string): AIMessage {
  return {
    role: 'assistant',
    content: `Oi, ${name?.split(' ')[0] || 'pessoal'}! Vamos organizar a vida financeira com calma e objetividade. Posso analisar o mês, avaliar uma compra, lançar uma movimentação ou ajudar a montar um plano.`,
    timestamp: new Date().toISOString(),
  }
}

export default function FinaPage() {
  const supabase = useMemo(() => createClient(), [])
  const [profile, setProfile] = useState<any>(null)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: currentProfile }, historyResponse] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        fetch('/api/ai'),
      ])
      setProfile(currentProfile)
      const history = historyResponse.ok ? await historyResponse.json() : { messages: [] }
      const stored = sessionStorage.getItem(chatStorageKey(user.id))
      let cachedMessages: AIMessage[] = []
      try {
        cachedMessages = stored ? JSON.parse(stored) as AIMessage[] : []
      } catch {
        sessionStorage.removeItem(chatStorageKey(user.id))
      }
      const remoteMessages = history.messages || []
      setMessages(cachedMessages.length > remoteMessages.length ? cachedMessages : remoteMessages.length ? remoteMessages : [initialMessage(currentProfile?.name)])
      setHistoryLoading(false)
    }
    load()
  }, [supabase])

  useEffect(() => {
    if (!profile?.id || messages.length === 0) return
    sessionStorage.setItem(chatStorageKey(profile.id), JSON.stringify(messages.slice(-60)))
  }, [messages, profile?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(content = input) {
    const text = content.trim()
    if (!text || loading) return
    const userMessage: AIMessage = { role: 'user', content: text, timestamp: new Date().toISOString() }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      if (!response.ok) throw new Error('AI request failed')
      const data = await response.json()
      setMessages(previous => [...previous, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      }])
    } catch {
      setMessages(previous => previous.slice(0, -1))
      toast.error('Não consegui falar com a Fina agora. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function resetConversation() {
    const response = await fetch('/api/ai', { method: 'DELETE' })
    if (!response.ok) return void toast.error('Não consegui iniciar uma nova conversa.')
    if (profile?.id) sessionStorage.removeItem(chatStorageKey(profile.id))
    setMessages([initialMessage(profile?.name)])
    toast.success('Nova conversa iniciada. A memória financeira foi preservada.')
  }

  return (
    <AppLayout profile={profile}>
      <div className="space-y-4">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-ai flex items-center justify-center shadow-float">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ color: '#F8FAFC' }}>Fina IA</h1>
                <p className="text-xs" style={{ color: '#94A3B8' }}>Assessoria financeira do casal</p>
              </div>
            </div>
          </div>
          <button onClick={resetConversation} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ color: '#CBD5E1', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Eraser className="w-4 h-4" />
            Nova conversa
          </button>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_290px] gap-4">
          <section className="min-h-[calc(100dvh-190px)] rounded-xl flex flex-col overflow-hidden"
            style={{ background: 'rgba(13,13,26,0.86)', border: '1px solid rgba(129,140,248,0.18)' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <Bot className="w-4 h-4" style={{ color: '#C084FC' }} />
              <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Conversa financeira</p>
              <span className="ml-auto text-[11px]" style={{ color: '#64748B' }}>Dados reais do sistema</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 max-h-[calc(100dvh-315px)]">
              {historyLoading ? (
                <div className="space-y-3">
                  <div className="skeleton h-16 rounded-xl w-2/3" />
                  <div className="skeleton h-12 rounded-xl w-1/2 ml-auto" />
                </div>
              ) : messages.map((message, index) => (
                <div key={`${message.timestamp}-${index}`} className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-ai flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className="max-w-[88%] md:max-w-[78%] px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-wrap break-words"
                    style={message.role === 'user'
                      ? { color: '#FFFFFF', background: '#4F46E5', borderTopRightRadius: 3 }
                      : { color: '#E2E8F0', background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.07)', borderTopLeftRadius: 3 }}>
                    {visibleMessage(message.content)}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-ai flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div className="px-4 py-3 rounded-xl text-sm" style={{ color: '#94A3B8', background: 'rgba(255,255,255,0.045)' }}>
                    Analisando o contexto financeiro...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 md:p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex gap-2">
                <textarea value={input} onChange={event => setInput(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      sendMessage()
                    }
                  }}
                  rows={2} placeholder="Pergunte, peça uma análise ou solicite um lançamento..."
                  className="input flex-1 resize-none text-sm" disabled={loading} />
                <button onClick={() => sendMessage()} disabled={!input.trim() || loading}
                  className="w-12 rounded-xl flex items-center justify-center bg-primary-600 hover:bg-primary-700 disabled:opacity-40 transition-colors"
                  title="Enviar mensagem">
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(34,211,238,0.055)', border: '1px solid rgba(34,211,238,0.16)' }}>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4" style={{ color: '#22D3EE' }} />
                <h2 className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Memória financeira</h2>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: '#94A3B8' }}>
                A Fina aprende prioridades e hábitos ao longo das conversas. Saldos e faturas são sempre recalculados com os dados atuais.
              </p>
            </section>

            <section className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4" style={{ color: '#A78BFA' }} />
                <h2 className="text-sm font-bold" style={{ color: '#F1F5F9' }}>Comece por aqui</h2>
              </div>
              <div className="space-y-2">
                {QUICK_PROMPTS.map(item => (
                  <button key={item.label} onClick={() => sendMessage(item.text)} disabled={loading}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-colors disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.055)' }}>
                    <item.icon className="w-4 h-4 flex-shrink-0" style={{ color: '#C4B5FD' }} />
                    <span className="text-xs font-medium" style={{ color: '#CBD5E1' }}>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </AppLayout>
  )
}
