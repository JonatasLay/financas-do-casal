'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { NumericFormat } from 'react-number-format'
import { toast } from 'sonner'
import { Plus, X, LineChart, TrendingUp, TrendingDown, Sparkles, Trash2, Edit2, Send, Bot } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Investment } from '@/types'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const pct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%'

const INVEST_TYPES = [
  { value: 'acao',       label: 'Ação',         icon: '📈', color: '#818CF8' },
  { value: 'fii',        label: 'FII',           icon: '🏢', color: '#F472B6' },
  { value: 'etf',        label: 'ETF',           icon: '🌐', color: '#22D3EE' },
  { value: 'cripto',     label: 'Cripto',        icon: '₿',  color: '#FBBF24' },
  { value: 'renda_fixa', label: 'Renda Fixa',   icon: '🏛️', color: '#34D399' },
  { value: 'fundo',      label: 'Fundo',         icon: '📊', color: '#C084FC' },
  { value: 'outro',      label: 'Outro',         icon: '💼', color: '#94A3B8' },
]

function getType(type: string) { return INVEST_TYPES.find(t => t.value === type) || INVEST_TYPES[6] }

function AddInvestmentModal({ open, onClose, onSuccess, editing }: { open: boolean; onClose: () => void; onSuccess: () => void; editing?: Investment | null }) {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [saving, setSaving]   = useState(false)
  const [name, setName]             = useState('')
  const [ticker, setTicker]         = useState('')
  const [type, setType]             = useState('acao')
  const [quantity, setQuantity]     = useState(0)
  const [avgPrice, setAvgPrice]     = useState(0)
  const [currentPrice, setCurrentPrice] = useState(0)
  const [notes, setNotes]           = useState('')

  const totalInvested = quantity * avgPrice
  const currentValue  = quantity * currentPrice
  const pl            = currentValue - totalInvested
  const plPct         = totalInvested > 0 ? (pl / totalInvested) * 100 : 0

  useEffect(() => {
    if (!open) return
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    }
    load()
    if (editing) {
      setName(editing.name); setTicker(editing.ticker || ''); setType(editing.type)
      setQuantity(Number(editing.quantity)); setAvgPrice(Number(editing.avg_price))
      setCurrentPrice(Number(editing.current_price)); setNotes(editing.notes || '')
    } else {
      setName(''); setTicker(''); setType('acao'); setQuantity(0); setAvgPrice(0); setCurrentPrice(0); setNotes('')
    }
  }, [open, editing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return void toast.error('Digite um nome')
    if (!profile?.household_id) return void toast.error('Perfil não encontrado')
    setSaving(true)
    const t = getType(type)
    try {
      const payload = {
        household_id: profile.household_id,
        name: name.trim(), ticker: ticker.trim().toUpperCase() || null, type,
        quantity, avg_price: avgPrice, current_price: currentPrice,
        total_invested: totalInvested,
        icon: t.icon, color: t.color,
        notes: notes.trim() || null,
      }
      if (editing) {
        const { error } = await supabase.from('investments').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Investimento atualizado! ✨')
      } else {
        const { error } = await supabase.from('investments').insert(payload)
        if (error) throw error
        toast.success('Investimento cadastrado! 📈')
      }
      onSuccess(); onClose()
    } catch (err: any) { toast.error(err.message || 'Erro ao salvar') } finally { setSaving(false) }
  }

  if (!open) return null
  const t = getType(type)
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-lg rounded-t-3xl md:rounded-2xl animate-slide-up max-h-[92dvh] flex flex-col"
        style={{ background: '#0F0F1E', border: '1px solid rgba(251,191,36,0.2)', boxShadow: '0 0 40px rgba(251,191,36,0.08)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-bold" style={{ color: '#F1F5F9' }}>{editing ? 'Editar Investimento' : 'Novo Investimento'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl" style={{ color: '#94A3B8' }}><X className="w-4 h-4" /></button>
        </div>
        <form id="invest-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Tipo */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Tipo</p>
            <div className="grid grid-cols-4 gap-2">
              {INVEST_TYPES.map(it => (
                <button key={it.value} type="button" onClick={() => setType(it.value)}
                  className="flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all text-xs font-medium"
                  style={{
                    background: type === it.value ? `${it.color}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${type === it.value ? it.color + '40' : 'rgba(255,255,255,0.06)'}`,
                    color: type === it.value ? it.color : '#94A3B8',
                  }}>
                  <span className="text-lg">{it.icon}</span>
                  <span>{it.label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Nome + Ticker */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Nome</p>
              <input className="input" placeholder='Ex: Petrobras, Bitcoin...' value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Ticker</p>
              <input className="input" placeholder='PETR4' value={ticker} onChange={e => setTicker(e.target.value)} />
            </div>
          </div>
          {/* Quantidade + Preço médio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Quantidade</p>
              <NumericFormat onValueChange={v => setQuantity(v.floatValue || 0)} decimalSeparator="," decimalScale={8} placeholder="0" inputMode="decimal" className="input" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Preço Médio</p>
              <NumericFormat onValueChange={v => setAvgPrice(v.floatValue || 0)} thousandSeparator="." decimalSeparator="," decimalScale={4} fixedDecimalScale prefix="R$ " placeholder="R$ 0,00" inputMode="decimal" className="input" />
            </div>
          </div>
          {/* Preço atual */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Preço Atual</p>
            <NumericFormat onValueChange={v => setCurrentPrice(v.floatValue || 0)} thousandSeparator="." decimalSeparator="," decimalScale={4} fixedDecimalScale prefix="R$ " placeholder="R$ 0,00" inputMode="decimal" className="input" />
          </div>
          {/* Preview P&L */}
          {totalInvested > 0 && (
            <div className="rounded-xl p-3 grid grid-cols-3 gap-3 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#475569' }}>Investido</p>
                <p className="text-sm font-bold font-mono-nums" style={{ color: '#F1F5F9' }}>{brl(totalInvested)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#475569' }}>Atual</p>
                <p className="text-sm font-bold font-mono-nums" style={{ color: '#F1F5F9' }}>{brl(currentValue)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide mb-1" style={{ color: '#475569' }}>P&L</p>
                <p className="text-sm font-bold font-mono-nums" style={{ color: pl >= 0 ? '#34D399' : '#F87171' }}>
                  {brl(pl)} <span className="text-[10px]">({pct(plPct)})</span>
                </p>
              </div>
            </div>
          )}
          {/* Obs */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Observação <span className="font-normal normal-case opacity-60">(opcional)</span></p>
            <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas..." />
          </div>
        </form>
        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button form="invest-form" type="submit" disabled={saving} className="btn-primary w-full"
            style={{ background: `linear-gradient(135deg, ${t.color}, ${t.color}cc)`, boxShadow: `0 0 20px ${t.color}30` }}>
            {saving ? 'Salvando...' : editing ? '✏️ Atualizar' : '📈 Cadastrar Investimento'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AIInvestAdvisor({ investments }: { investments: Investment[] }) {
  const [messages, setMessages] = useState<{ role: string; text: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const QUICK = [
    'Como está minha carteira?',
    'Devo diversificar mais?',
    'Onde investir meu saldo mensal?',
    'Qual a melhor estratégia para FIIs?',
  ]

  const send = async (text?: string) => {
    const q = (text || input).trim()
    if (!q || loading) return
    setMessages(prev => [...prev, { role: 'user', text: q }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'investment', investmentQuestion: q, messages: [] }) })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', text: data.response }])
    } catch { toast.error('Erro ao contatar a Fina') } finally { setLoading(false) }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="card w-full p-4 flex items-center gap-3 transition-all hover:scale-[1.01] text-left"
        style={{ border: '1px solid rgba(192,132,252,0.2)', background: 'rgba(192,132,252,0.04)' }}>
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #818CF8, #F472B6)', boxShadow: '0 0 20px rgba(129,140,248,0.3)' }}>
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>Fina — Consultora de Investimentos</p>
          <p className="text-xs" style={{ color: '#475569' }}>Pergunte sobre sua carteira, estratégias e alocação</p>
        </div>
        <Sparkles className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: '#818CF8' }} />
      </button>
    )
  }

  return (
    <div className="card" style={{ border: '1px solid rgba(129,140,248,0.2)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #818CF8, #F472B6)' }}>
          <Bot className="w-4 h-4 text-white" />
        </div>
        <p className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>Fina — Consultora de Investimentos</p>
        <button onClick={() => setOpen(false)} className="ml-auto p-1 rounded-lg" style={{ color: '#475569' }}><X className="w-3.5 h-3.5" /></button>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK.map(q => (
            <button key={q} onClick={() => send(q)} className="text-xs px-3 py-1.5 rounded-xl transition-all"
              style={{ background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', color: '#818CF8' }}>
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'text-white' : ''}`}
              style={m.role === 'user'
                ? { background: 'linear-gradient(135deg, #818CF8, #6366F1)' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: '#94A3B8' }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2">
            <div className="px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: '#818CF8' }} />
                <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: '#818CF8' }} />
                <div className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: '#818CF8' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input className="input flex-1 text-sm" placeholder="Pergunte sobre investimentos..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} disabled={loading} />
        <button onClick={() => send()} disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40 transition-all active:scale-95 text-white"
          style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}>
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

export default function InvestmentsPage() {
  const supabase = createClient()
  const [profile, setProfile]         = useState<any>(null)
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading]         = useState(true)
  const [showAdd, setShowAdd]         = useState(false)
  const [editing, setEditing]         = useState<Investment | null>(null)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    if (!prof?.household_id) { setLoading(false); return }
    const { data } = await supabase.from('investments').select('*').eq('household_id', prof.household_id).order('created_at')
    setInvestments((data || []) as Investment[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este investimento?')) return
    await supabase.from('investments').delete().eq('id', id)
    toast.success('Removido!')
    fetchData()
  }

  const totalInvested   = investments.reduce((s, i) => s + Number(i.total_invested), 0)
  const totalCurrent    = investments.reduce((s, i) => s + Number(i.quantity) * Number(i.current_price), 0)
  const totalPL         = totalCurrent - totalInvested
  const totalPLPct      = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0

  const allocationData = INVEST_TYPES.map(t => {
    const value = investments.filter(i => i.type === t.value).reduce((s, i) => s + Number(i.quantity) * Number(i.current_price), 0)
    return { name: t.label, value, color: t.color, icon: t.icon }
  }).filter(d => d.value > 0)

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="rounded-xl px-3 py-2 text-xs" style={{ background: '#111124', border: '1px solid rgba(129,140,248,0.2)', color: '#F1F5F9' }}>
        <p className="font-bold">{payload[0].name}</p>
        <p style={{ color: payload[0].payload.color }}>{brl(payload[0].value)}</p>
        <p style={{ color: '#475569' }}>{totalCurrent > 0 ? ((payload[0].value / totalCurrent) * 100).toFixed(1) : 0}%</p>
      </div>
    )
  }

  return (
    <AppLayout profile={profile}>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #FBBF24, #F472B6)', boxShadow: '0 0 20px rgba(251,191,36,0.4)' }}>
              <LineChart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold" style={{ color: '#F1F5F9' }}>Investimentos</h1>
              <p className="text-xs" style={{ color: '#475569' }}>Carteira e patrimônio variável</p>
            </div>
          </div>
          <button onClick={() => { setEditing(null); setShowAdd(true) }} className="btn-primary px-3 py-2 text-sm flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #FBBF24, #F472B6)', boxShadow: '0 0 20px rgba(251,191,36,0.3)' }}>
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>

        {/* Portfolio summary */}
        {investments.length > 0 && (
          <>
            <div className="card-amber p-5">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="stat-label mb-1">Investido</p>
                  <p className="text-xl font-bold font-mono-nums" style={{ color: '#F1F5F9' }}>{brl(totalInvested)}</p>
                </div>
                <div>
                  <p className="stat-label mb-1">Valor Atual</p>
                  <p className="text-xl font-bold font-mono-nums" style={{ color: '#FBBF24' }}>{brl(totalCurrent)}</p>
                </div>
                <div>
                  <p className="stat-label mb-1">Retorno</p>
                  <div className="flex items-center gap-1">
                    {totalPL >= 0 ? <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: '#34D399' }} /> : <TrendingDown className="w-4 h-4 flex-shrink-0" style={{ color: '#F87171' }} />}
                    <p className="text-lg font-bold font-mono-nums" style={{ color: totalPL >= 0 ? '#34D399' : '#F87171' }}>{pct(totalPLPct)}</p>
                  </div>
                  <p className="text-xs font-mono-nums" style={{ color: totalPL >= 0 ? '#34D399' : '#F87171' }}>{brl(totalPL)}</p>
                </div>
              </div>
              <div className="glow-line" />
            </div>

            {/* Allocation chart */}
            {allocationData.length > 1 && (
              <div className="card p-4">
                <p className="text-sm font-semibold mb-3" style={{ color: '#F1F5F9' }}>Alocação da Carteira</p>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={allocationData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={3} dataKey="value">
                          {allocationData.map((entry, i) => <Cell key={i} fill={entry.color} strokeWidth={0} />)}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {allocationData.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                        <span className="text-xs flex-1" style={{ color: '#94A3B8' }}>{d.icon} {d.name}</span>
                        <span className="text-xs font-mono-nums font-medium" style={{ color: d.color }}>
                          {totalCurrent > 0 ? ((d.value / totalCurrent) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* AI Advisor */}
        <AIInvestAdvisor investments={investments} />

        {/* Holdings list */}
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
        ) : investments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 animate-float"
              style={{ background: 'linear-gradient(135deg, #FBBF24, #F472B6)', boxShadow: '0 0 40px rgba(251,191,36,0.3)' }}>
              <LineChart className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: '#F1F5F9' }}>Nenhum investimento cadastrado</h3>
            <p className="text-sm max-w-xs" style={{ color: '#475569' }}>Cadastre suas ações, FIIs, ETFs, criptos e acompanhe seu patrimônio.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#475569' }}>Holdings ({investments.length})</p>
            {investments.map(inv => {
              const t          = getType(inv.type)
              const currVal    = Number(inv.quantity) * Number(inv.current_price)
              const invested   = Number(inv.total_invested)
              const pl         = currVal - invested
              const plP        = invested > 0 ? (pl / invested) * 100 : 0
              const weight     = totalCurrent > 0 ? (currVal / totalCurrent) * 100 : 0
              return (
                <div key={inv.id} className="card p-4 transition-all hover:scale-[1.01]"
                  style={{ border: `1px solid ${t.color}20` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                      style={{ background: `${t.color}18`, border: `1px solid ${t.color}30` }}>
                      {t.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>{inv.name}</p>
                        {inv.ticker && <span className="badge badge-primary text-[10px]">{inv.ticker}</span>}
                        <span className="badge text-[10px]" style={{ background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}30` }}>{t.label}</span>
                        <span className="text-xs ml-auto" style={{ color: '#475569' }}>{weight.toFixed(1)}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#475569' }}>Investido</p>
                          <p className="text-sm font-bold font-mono-nums" style={{ color: '#94A3B8' }}>{brl(invested)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#475569' }}>Atual</p>
                          <p className="text-sm font-bold font-mono-nums" style={{ color: t.color }}>{brl(currVal)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: '#475569' }}>P&L</p>
                          <p className="text-sm font-bold font-mono-nums" style={{ color: pl >= 0 ? '#34D399' : '#F87171' }}>
                            {pct(plP)}
                          </p>
                          <p className="text-[10px] font-mono-nums" style={{ color: pl >= 0 ? '#34D399' : '#F87171' }}>{brl(pl)}</p>
                        </div>
                      </div>
                      <div className="mt-2 progress-bar">
                        <div className="progress-fill" style={{ width: `${weight}%`, background: `linear-gradient(90deg, ${t.color}, ${t.color}aa)` }} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => { setEditing(inv); setShowAdd(true) }} className="p-1.5 rounded-lg" style={{ color: '#475569' }}><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(inv.id)} className="p-1.5 rounded-lg" style={{ color: '#475569' }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AddInvestmentModal open={showAdd} onClose={() => { setShowAdd(false); setEditing(null) }} onSuccess={fetchData} editing={editing} />
    </AppLayout>
  )
}
