'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, RefreshCw, Send, Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AIMessage } from '@/types'

const chatStorageKey = (userId: string) => `fina-chat:${userId}`

function initialMessage(name?: string): AIMessage {
  return {
    role: 'assistant',
    content: `Oi, ${name?.split(' ')[0] || 'amor'}! Sou a Fina. Me chama para analisar compras, lançar despesas/receitas ou pensar no plano financeiro de vocês.`,
    timestamp: new Date().toISOString(),
  }
}

export function FinaChatBubble({ profile }: { profile?: any }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!profile?.id) return
    const fallback = initialMessage(profile?.name)
    const stored = sessionStorage.getItem(chatStorageKey(profile.id))
    let parsed: AIMessage[] = []
    try {
      parsed = stored ? JSON.parse(stored) as AIMessage[] : []
    } catch {
      sessionStorage.removeItem(chatStorageKey(profile.id))
    }
    setMessages(parsed.length ? parsed : [fallback])
  }, [profile?.id, profile?.name])

  useEffect(() => {
    if (!profile?.id || messages.length === 0) return
    sessionStorage.setItem(chatStorageKey(profile.id), JSON.stringify(messages.slice(-60)))
  }, [profile?.id, messages])

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, open])

  const resetChat = () => {
    if (profile?.id) sessionStorage.removeItem(chatStorageKey(profile.id))
    setMessages([initialMessage(profile?.name)])
  }

  const sendMessage = async () => {
    const msg = input.trim()
    if (!msg || loading) return
    const userMessage: AIMessage = { role: 'user', content: msg, timestamp: new Date().toISOString() }
    const nextMessages = [...messages, userMessage]

    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      if (!res.ok) throw new Error('Erro na resposta')
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
      }])
    } catch {
      toast.error('Erro ao contatar a Fina. Tente novamente.')
      setMessages(prev => prev.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  if (!profile?.id) return null

  return (
    <>
      {open && (
        <div
          className="fixed right-4 bottom-40 md:right-8 md:bottom-28 z-50 w-[calc(100vw-2rem)] max-w-[390px] overflow-hidden rounded-2xl shadow-2xl animate-slide-up"
          style={{ background: 'rgba(13,13,26,0.96)', border: '1px solid rgba(192,132,252,0.28)', backdropFilter: 'blur(18px)' }}
        >
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="w-9 h-9 bg-gradient-ai rounded-2xl flex items-center justify-center shadow-float">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: '#F8FAFC' }}>Fina IA</p>
              <p className="text-[11px]" style={{ color: '#94A3B8' }}>Assistente financeira do casal</p>
            </div>
            <button onClick={resetChat} className="p-2 rounded-xl transition-colors" style={{ color: '#94A3B8' }} title="Nova conversa">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button onClick={() => setOpen(false)} className="p-2 rounded-xl transition-colors" style={{ color: '#94A3B8' }} title="Fechar">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="h-[440px] max-h-[55dvh] overflow-y-auto p-4 space-y-3">
            {messages.map((msg, index) => (
              <div key={index} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 bg-gradient-ai rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
                <div
                  className="max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
                  style={msg.role === 'user'
                    ? { background: '#6366F1', color: '#FFFFFF', borderTopRightRadius: 4 }
                    : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#E2E8F0', borderTopLeftRadius: 4 }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 bg-gradient-ai rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="rounded-2xl rounded-tl px-4 py-3" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-primary-400 rounded-full typing-dot" />
                    <div className="w-2 h-2 bg-primary-400 rounded-full typing-dot" />
                    <div className="w-2 h-2 bg-primary-400 rounded-full typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <input
              className="input flex-1 text-sm"
              placeholder="Fale com a Fina..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-10 h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 flex-shrink-0"
              title="Enviar"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(v => !v)}
        className="fixed right-5 bottom-40 md:right-8 md:bottom-28 z-40 w-14 h-14 rounded-2xl bg-gradient-ai shadow-float flex items-center justify-center transition-transform duration-150 active:scale-95"
        aria-label="Abrir Fina IA"
        title="Fina IA"
      >
        <Bot className="w-6 h-6 text-white" />
      </button>
    </>
  )
}
