'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Send, Sparkles, ShoppingBag, RefreshCw, Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { AIMessage } from '@/types'

const SUGGESTIONS = [
  { text: '📊 Analise meu mês atual', emoji: '📊' },
  { text: '💡 Onde estou gastando mais?', emoji: '💡' },
  { text: '🎯 Como chegar mais rápido nas minhas metas?', emoji: '🎯' },
  { text: '🏦 Como montar minha reserva de emergência?', emoji: '🏦' },
  { text: '✂️ O que posso cortar para economizar?', emoji: '✂️' },
  { text: '✈️ Quando consigo viajar sem comprometer as contas?', emoji: '✈️' },
]

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const chatStorageKey = (userId: string) => `fina-chat:${userId}`

export default function AIPage() {
  const supabase = createClient()

  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [purchaseMode, setPurchaseMode] = useState(false)
  const [purchaseItem, setPurchaseItem] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Init ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      const initialMessage: AIMessage = {
        role: 'assistant',
        content: `Oi, ${data?.name?.split(' ')[0] || 'amor'}! 💜 Sou a Fina, sua assistente financeira!\n\nAnalisei seus dados e estou pronta para ajudar. Você pode me perguntar sobre gastos, metas, economias — ou usar o modo "Devo comprar?" para avaliar uma compra antes de fazer!\n\nO que você quer saber?`,
        timestamp: new Date().toISOString(),
      }
      const stored = sessionStorage.getItem(chatStorageKey(user.id))
      let parsed: AIMessage[] = []
      try {
        parsed = stored ? JSON.parse(stored) as AIMessage[] : []
      } catch {
        sessionStorage.removeItem(chatStorageKey(user.id))
      }
      setMessages(parsed.length ? parsed : [initialMessage])
    }
    load()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (!profile?.id || messages.length === 0) return
    sessionStorage.setItem(chatStorageKey(profile.id), JSON.stringify(messages.slice(-60)))
  }, [profile?.id, messages])

  // ── Chat ──────────────────────────────────────────────────────────────────────

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const userMessage: AIMessage = { role: 'user', content: msg, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
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
      inputRef.current?.focus()
    }
  }

  const analyzePurchase = async () => {
    if (!purchaseItem || !purchasePrice) return
    const userMsg = `Devo comprar: "${purchaseItem}" por R$ ${purchasePrice}`
    setMessages(prev => [...prev, { role: 'user', content: userMsg, timestamp: new Date().toISOString() }])
    setLoading(true)
    setPurchaseMode(false)

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'purchase', purchaseItem, purchasePrice: parseFloat(purchasePrice), messages: [] }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response, timestamp: new Date().toISOString() }])
    } catch {
      toast.error('Erro ao analisar compra.')
    } finally {
      setLoading(false)
      setPurchaseItem('')
      setPurchasePrice('')
    }
  }

  // ── Share analysis ────────────────────────────────────────────────────────────

  const shareAnalysis = useCallback(async () => {
    if (!profile?.household_id) { toast.error('Faça login para compartilhar'); return }
    setSharing(true)

    try {
      const now = new Date()
      const start = format(startOfMonth(now), 'yyyy-MM-dd')
      const end   = format(endOfMonth(now),   'yyyy-MM-dd')

      const [txRes, goalsRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('amount, type, status, category:categories(name, icon)')
          .eq('household_id', profile.household_id)
          .eq('status', 'realizado')
          .gte('date', start)
          .lte('date', end),
        supabase
          .from('goals')
          .select('name, target_amount, current_amount, icon')
          .eq('household_id', profile.household_id)
          .eq('is_completed', false),
      ])

      const txs    = txRes.data || []
      const income   = txs.filter((t: any) => t.type === 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0)
      const expenses = txs.filter((t: any) => t.type !== 'receita').reduce((s: number, t: any) => s + Number(t.amount), 0)
      const balance  = income - expenses

      // Top 3 expense categories
      const catMap: Record<string, { name: string; icon: string; amount: number }> = {}
      for (const tx of txs as any[]) {
        if (tx.type !== 'receita' && tx.category) {
          const k = tx.category.name
          if (!catMap[k]) catMap[k] = { name: k, icon: tx.category.icon, amount: 0 }
          catMap[k].amount += Number(tx.amount)
        }
      }
      const topCats = Object.values(catMap).sort((a, b) => b.amount - a.amount).slice(0, 3)

      const goals = (goalsRes.data || []) as any[]
      const monthLabel = format(now, "MMMM 'de' yyyy", { locale: ptBR })

      let text = `📊 RESUMO FINANCEIRO — ${monthLabel}\n`
      text += `💜 Finanças do Casal\n`
      text += `─────────────────────\n`
      text += `💰 Receita:   ${brl(income)}\n`
      text += `💸 Despesas:  ${brl(expenses)}\n`
      text += `${balance >= 0 ? '✅' : '⚠️'} Saldo:     ${brl(balance)}\n`

      if (topCats.length > 0) {
        text += `\n🏆 TOP GASTOS:\n`
        for (const cat of topCats) {
          text += `  ${cat.icon} ${cat.name}: ${brl(cat.amount)}\n`
        }
      }

      if (goals.length > 0) {
        text += `\n🎯 METAS:\n`
        for (const g of goals) {
          const pct = g.target_amount > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0
          text += `  ${g.icon} ${g.name}: ${pct}% concluída\n`
        }
      }

      text += `\n─────────────────────\n`
      text += `Gerado pelo Finanças do Casal 💜`

      await navigator.clipboard.writeText(text)
      toast.success('Resumo copiado! Cole onde quiser 📋')
    } catch (err) {
      toast.error('Não foi possível copiar o resumo')
    } finally {
      setSharing(false)
    }
  }, [profile, supabase])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <AppLayout profile={profile}>
      <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-5rem)] pb-20 md:pb-4">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4 flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-ai rounded-2xl flex items-center justify-center shadow-float flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-gray-900 leading-tight">Fina — IA Financeira</h1>
            <p className="text-xs text-gray-500 hidden sm:block">Sua conselheira financeira pessoal 💜</p>
          </div>

          {/* Share button */}
          <button
            onClick={shareAnalysis}
            disabled={sharing}
            title="Compartilhar análise do mês"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-all active:scale-95 flex-shrink-0"
          >
            {sharing
              ? <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              : <Share2 className="w-3.5 h-3.5" />
            }
            <span className="hidden sm:inline">{sharing ? 'Copiando...' : 'Compartilhar'}</span>
          </button>

          {/* New conversation */}
          <button
            onClick={() => {
              if (profile?.id) sessionStorage.removeItem(chatStorageKey(profile.id))
              setMessages(prev => [prev[0]])
            }}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0"
            title="Nova conversa"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Quick suggestions (only shown on first message) */}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 mb-3 flex-shrink-0">
            {SUGGESTIONS.map(s => (
              <button
                key={s.text}
                onClick={() => sendMessage(s.text)}
                className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-xl hover:bg-primary-50 hover:border-primary-200 hover:text-primary-700 transition-all duration-150"
              >
                {s.text}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-0.5 min-h-0">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2 animate-slide-up ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 bg-gradient-ai rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words
                  ${msg.role === 'user'
                    ? 'bg-primary-600 text-white rounded-tr-sm'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-card'
                  }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex gap-2 animate-fade-in">
              <div className="w-7 h-7 bg-gradient-ai rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-card">
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 bg-primary-400 rounded-full typing-dot" />
                  <div className="w-2 h-2 bg-primary-400 rounded-full typing-dot" />
                  <div className="w-2 h-2 bg-primary-400 rounded-full typing-dot" />
                  <span className="text-xs text-gray-400 ml-1">Fina está pensando...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Purchase mode panel */}
        {purchaseMode && (
          <div className="card mb-3 border-primary-200 bg-primary-50 animate-slide-up flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="w-4 h-4 text-primary-600" />
              <p className="text-sm font-semibold text-primary-800">Analisar compra</p>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                className="input flex-1 text-sm"
                placeholder="O que você quer comprar?"
                value={purchaseItem}
                onChange={e => setPurchaseItem(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && analyzePurchase()}
              />
              <input
                className="input w-28 text-sm"
                type="number"
                inputMode="decimal"
                placeholder="R$ valor"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && analyzePurchase()}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={analyzePurchase} disabled={!purchaseItem || !purchasePrice} className="btn-primary text-sm px-4 py-2 disabled:opacity-50">
                🔍 Analisar
              </button>
              <button onClick={() => setPurchaseMode(false)} className="btn-secondary text-sm px-4 py-2">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="flex gap-2 mt-3 flex-shrink-0">
          <button
            onClick={() => setPurchaseMode(!purchaseMode)}
            title="Devo comprar?"
            className={`p-2.5 rounded-xl border transition-all duration-150 flex-shrink-0
              ${purchaseMode
                ? 'bg-primary-100 border-primary-300 text-primary-700'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
          >
            <ShoppingBag className="w-4 h-4" />
          </button>
          <input
            ref={inputRef}
            className="input flex-1 text-sm"
            placeholder="Pergunte à Fina..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-10 h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-all duration-150 active:scale-95 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </AppLayout>
  )
}
