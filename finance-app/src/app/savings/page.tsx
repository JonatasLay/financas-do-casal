'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { NumericFormat } from 'react-number-format'
import { toast } from 'sonner'
import { Plus, X, PiggyBank, TrendingUp, Sparkles, Trash2, Edit2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Savings } from '@/types'

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const SAVINGS_TYPES: { value: string; label: string; color: string; desc: string }[] = [
  { value: 'poupança',  label: 'Poupança',      color: '#34D399', desc: '~6% a.a.' },
  { value: 'cdb',       label: 'CDB',            color: '#22D3EE', desc: '100-115% CDI' },
  { value: 'lci',       label: 'LCI',            color: '#818CF8', desc: 'Isento IR' },
  { value: 'lca',       label: 'LCA',            color: '#C084FC', desc: 'Isento IR' },
  { value: 'tesouro',   label: 'Tesouro Direto', color: '#FBBF24', desc: 'Selic/IPCA+' },
  { value: 'fundo',     label: 'Fundo',          color: '#F472B6', desc: 'Diversificado' },
  { value: 'outro',     label: 'Outro',          color: '#94A3B8', desc: '' },
]

const TYPE_ICONS: Record<string, string> = {
  poupança: '🏦', cdb: '💳', lci: '🏡', lca: '🌾', tesouro: '🏛️', fundo: '📊', outro: '💰',
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-4 animate-float"
        style={{ background: 'linear-gradient(135deg, #34D399, #22D3EE)', boxShadow: '0 0 40px rgba(52,211,153,0.3)' }}>
        <PiggyBank className="w-10 h-10 text-white" />
      </div>
      <h3 className="text-lg font-bold mb-2" style={{ color: '#F1F5F9' }}>Nenhuma poupança cadastrada</h3>
      <p className="text-sm max-w-xs" style={{ color: '#475569' }}>
        Cadastre suas contas de poupança, CDBs, LCIs, Tesouro Direto e acompanhe tudo num só lugar.
      </p>
    </div>
  )
}

function AddSavingsModal({ open, onClose, onSuccess, editing }: { open: boolean; onClose: () => void; onSuccess: () => void; editing?: Savings | null }) {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName]         = useState('')
  const [institution, setInstitution] = useState('')
  const [type, setType]         = useState('poupança')
  const [amount, setAmount]     = useState(0)
  const [target, setTarget]     = useState(0)
  const [rate, setRate]         = useState(0)
  const [notes, setNotes]       = useState('')

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
      setName(editing.name); setInstitution(editing.institution || ''); setType(editing.type)
      setAmount(editing.current_amount); setTarget(editing.target_amount || 0)
      setRate(editing.interest_rate || 0); setNotes(editing.notes || '')
    } else {
      setName(''); setInstitution(''); setType('poupança'); setAmount(0); setTarget(0); setRate(0); setNotes('')
    }
  }, [open, editing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return void toast.error('Digite um nome')
    if (!profile?.household_id) return void toast.error('Perfil não encontrado')
    setSaving(true)
    try {
      const payload = {
        household_id:    profile.household_id,
        name:            name.trim(),
        institution:     institution.trim() || null,
        type,
        current_amount:  amount,
        target_amount:   target > 0 ? target : null,
        interest_rate:   rate > 0 ? rate : null,
        notes:           notes.trim() || null,
        icon:            TYPE_ICONS[type] || '💰',
      }
      if (editing) {
        const { error } = await supabase.from('savings').update(payload).eq('id', editing.id)
        if (error) throw error
        toast.success('Poupança atualizada! ✨')
      } else {
        const { error } = await supabase.from('savings').insert(payload)
        if (error) throw error
        toast.success('Poupança cadastrada! 💰')
      }
      onSuccess(); onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-lg rounded-t-3xl md:rounded-2xl animate-slide-up max-h-[90dvh] flex flex-col"
        style={{ background: '#0F0F1E', border: '1px solid rgba(52,211,153,0.2)', boxShadow: '0 0 40px rgba(52,211,153,0.1)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="font-bold" style={{ color: '#F1F5F9' }}>{editing ? 'Editar Poupança' : 'Nova Poupança'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl transition-colors" style={{ color: '#94A3B8' }}><X className="w-4 h-4" /></button>
        </div>
        <form id="savings-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Tipo */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Tipo</p>
            <div className="grid grid-cols-2 gap-2">
              {SAVINGS_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                  style={{
                    background: type === t.value ? `${t.color}18` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${type === t.value ? t.color + '40' : 'rgba(255,255,255,0.06)'}`,
                    color: type === t.value ? t.color : '#94A3B8',
                  }}>
                  <span>{TYPE_ICONS[t.value]}</span>
                  <div>
                    <p className="font-medium">{t.label}</p>
                    {t.desc && <p className="text-[10px] opacity-60">{t.desc}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>
          {/* Nome */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Nome</p>
            <input className="input" placeholder='Ex: Poupança Nubank, CDB Inter...' value={name} onChange={e => setName(e.target.value)} />
          </div>
          {/* Instituição */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Instituição <span className="font-normal normal-case opacity-60">(opcional)</span></p>
            <input className="input" placeholder='Ex: Nubank, Banco Inter, XP...' value={institution} onChange={e => setInstitution(e.target.value)} />
          </div>
          {/* Valor atual */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Saldo Atual</p>
            <NumericFormat onValueChange={v => setAmount(v.floatValue || 0)} thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale prefix="R$ " placeholder="R$ 0,00" inputMode="decimal" className="input text-xl font-bold" style={{ color: '#34D399' }} />
          </div>
          {/* Taxa */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Taxa de Rendimento <span className="font-normal normal-case opacity-60">(% a.a.)</span></p>
            <NumericFormat onValueChange={v => setRate(v.floatValue || 0)} decimalSeparator="," decimalScale={2} suffix="% a.a." placeholder="0,00% a.a." inputMode="decimal" className="input" />
          </div>
          {/* Meta */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Meta <span className="font-normal normal-case opacity-60">(opcional)</span></p>
            <NumericFormat onValueChange={v => setTarget(v.floatValue || 0)} thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale prefix="R$ " placeholder="R$ 0,00" inputMode="decimal" className="input" />
          </div>
          {/* Obs */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>Observação <span className="font-normal normal-case opacity-60">(opcional)</span></p>
            <textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas..." />
          </div>
        </form>
        <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button form="savings-form" type="submit" disabled={saving} className="btn-primary w-full"
            style={{ background: 'linear-gradient(135deg, #34D399, #22D3EE)', boxShadow: '0 0 20px rgba(52,211,153,0.3)' }}>
            {saving ? 'Salvando...' : editing ? '✏️ Atualizar' : '💰 Cadastrar Poupança'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SavingsPage() {
  const supabase = createClient()
  const [profile, setProfile]   = useState<any>(null)
  const [savings, setSavings]   = useState<Savings[]>([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [editing, setEditing]   = useState<Savings | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [aiTip, setAiTip]       = useState<string | null>(null)
  const [loadingTip, setLoadingTip] = useState(false)

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    if (!prof?.household_id) { setLoading(false); return }
    const { data } = await supabase.from('savings').select('*').eq('household_id', prof.household_id).order('created_at')
    setSavings((data || []) as Savings[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (savings.length === 0) return
    setLoadingTip(true)
    fetch('/api/ai/tip').then(r => r.json()).then(d => setAiTip(d.tip)).catch(() => {}).finally(() => setLoadingTip(false))
  }, [savings.length])

  const handleDelete = async () => {
    if (!deletingId) return
    await supabase.from('savings').delete().eq('id', deletingId)
    toast.success('Removida!')
    setDeletingId(null)
    fetchData()
  }

  const totalSaved = savings.reduce((s, sv) => s + Number(sv.current_amount), 0)

  const projectedYield = savings.reduce((s, sv) => {
    if (!sv.interest_rate) return s
    return s + (Number(sv.current_amount) * Number(sv.interest_rate) / 100)
  }, 0)

  const typeColor = (type: string) => SAVINGS_TYPES.find(t => t.value === type)?.color || '#94A3B8'

  return (
    <AppLayout profile={profile}>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #34D399, #22D3EE)', boxShadow: '0 0 20px rgba(52,211,153,0.4)' }}>
              <PiggyBank className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold" style={{ color: '#F1F5F9' }}>Poupança</h1>
              <p className="text-xs" style={{ color: '#475569' }}>Reservas e renda fixa conservadora</p>
            </div>
          </div>
          <button onClick={() => { setEditing(null); setShowAdd(true) }} className="btn-primary px-3 py-2 text-sm flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #34D399, #22D3EE)', boxShadow: '0 0 20px rgba(52,211,153,0.3)' }}>
            <Plus className="w-4 h-4" /> Adicionar
          </button>
        </div>

        {/* Summary cards */}
        {savings.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="card-green p-4">
              <p className="stat-label mb-1">Total Guardado</p>
              <p className="text-2xl font-bold font-mono-nums" style={{ color: '#34D399' }}>{brl(totalSaved)}</p>
              <p className="text-xs mt-1" style={{ color: '#475569' }}>{savings.length} {savings.length === 1 ? 'conta' : 'contas'}</p>
            </div>
            <div className="card p-4">
              <p className="stat-label mb-1">Rendimento Est. / Ano</p>
              <p className="text-2xl font-bold font-mono-nums" style={{ color: '#22D3EE' }}>{brl(projectedYield)}</p>
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#475569' }}>
                <TrendingUp className="w-3 h-3" /> Baseado nas taxas cadastradas
              </p>
            </div>
          </div>
        )}

        {/* AI Tip */}
        {(aiTip || loadingTip) && (
          <div className="card p-4 flex gap-3" style={{ border: '1px solid rgba(52,211,153,0.2)', background: 'rgba(52,211,153,0.04)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #818CF8, #F472B6)' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold mb-0.5" style={{ color: '#818CF8' }}>Fina IA</p>
              {loadingTip
                ? <div className="skeleton h-4 w-48 rounded" />
                : <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>{aiTip}</p>
              }
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-2xl" />)}
          </div>
        ) : savings.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {savings.map(sv => {
              const pct    = sv.target_amount ? Math.min(100, (Number(sv.current_amount) / Number(sv.target_amount)) * 100) : 0
              const color  = typeColor(sv.type)
              const yearly = sv.interest_rate ? Number(sv.current_amount) * Number(sv.interest_rate) / 100 : 0
              const typeInfo = SAVINGS_TYPES.find(t => t.value === sv.type)
              return (
                <div key={sv.id} className="card p-4 transition-all hover:scale-[1.01]"
                  style={{ border: `1px solid ${color}20` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                      style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                      {TYPE_ICONS[sv.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-sm truncate" style={{ color: '#F1F5F9' }}>{sv.name}</p>
                        <span className="badge text-[10px]" style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
                          {typeInfo?.label}
                        </span>
                      </div>
                      {sv.institution && <p className="text-xs mb-1" style={{ color: '#475569' }}>{sv.institution}</p>}
                      <p className="text-xl font-bold font-mono-nums" style={{ color }}>{brl(Number(sv.current_amount))}</p>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {sv.interest_rate && (
                          <span className="text-xs" style={{ color: '#34D399' }}>
                            📈 {sv.interest_rate}% a.a. ≈ {brl(yearly/12)}/mês
                          </span>
                        )}
                        {sv.target_amount && (
                          <span className="text-xs" style={{ color: '#475569' }}>
                            🎯 Meta: {brl(Number(sv.target_amount))}
                          </span>
                        )}
                      </div>
                      {sv.target_amount && sv.target_amount > 0 && (
                        <div className="mt-2">
                          <div className="progress-bar">
                            <div className="progress-fill" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}aa)` }} />
                          </div>
                          <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>{pct.toFixed(1)}% da meta</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => { setEditing(sv); setShowAdd(true) }}
                        className="p-1.5 rounded-lg transition-colors" style={{ color: '#475569' }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeletingId(sv.id)}
                        className="p-1.5 rounded-lg transition-colors" style={{ color: '#475569' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AddSavingsModal open={showAdd} onClose={() => { setShowAdd(false); setEditing(null) }} onSuccess={fetchData} editing={editing} />

      <ConfirmDialog
        open={!!deletingId}
        title="Remover poupança?"
        message="Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
    </AppLayout>
  )
}
