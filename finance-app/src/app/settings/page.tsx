'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { NumericFormat } from 'react-number-format'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { UserAdminTab } from '@/components/settings/UserAdminTab'
import { SecurityTab } from '@/components/settings/SecurityTab'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trash2, Plus, Save, AlertTriangle, ChevronDown, ChevronUp, Camera, Pencil, X, Eye, EyeOff, Users, KeyRound, ShieldCheck } from 'lucide-react'
import type { Category, Bank, Budget, Profile } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = ['#818CF8','#EC4899','#34D399','#FBBF24','#F87171','#C084FC','#22D3EE','#FB923C']
const AVATAR_EMOJIS = ['👤','😊','🥰','😎','🤩','🧔','👩','🦸','🐶','🐱','🦊','🐯','🦁','🐻','🐼','🌻']
const CAT_ICONS = ['🛒','🍕','🍺','☕','🚗','🏠','💡','💊','👕','📱','🎬','✈️','🎓','📚','🎮','🎁','🏋️','🎵','🐾','🌿','💄','🚌','🔧','🏦','💳','💰','📊','🍔']
const CAT_COLORS = ['#818CF8','#34D399','#FBBF24','#F87171','#C084FC','#F472B6','#22D3EE','#FB923C','#14B8A6','#84CC16','#F43F5E','#A855F7','#06B6D4','#D97706','#6B7280','#1D4ED8']
const BANK_TYPES = [
  { value: 'conta',        label: 'Conta corrente' },
  { value: 'credito',      label: 'Cartão crédito' },
  { value: 'debito',       label: 'Cartão débito'  },
  { value: 'dinheiro',     label: 'Dinheiro'       },
  { value: 'investimento', label: 'Investimento'   },
]
const PRESET_BANKS = [
  { name: 'Nubank',         color: '#8A05BE', icon: '💜', type: 'credito'  },
  { name: 'Inter',          color: '#FF6B35', icon: '🧡', type: 'conta'    },
  { name: 'Banco do Brasil',color: '#F7C948', icon: '🟡', type: 'conta'    },
  { name: 'Itaú',           color: '#EC7000', icon: '🟠', type: 'conta'    },
  { name: 'Bradesco',       color: '#CC092F', icon: '🔴', type: 'conta'    },
  { name: 'Caixa',          color: '#005CA9', icon: '💙', type: 'conta'    },
  { name: 'Mag Luiza',      color: '#0086FF', icon: '💳', type: 'credito'  },
  { name: 'Dinheiro',       color: '#34D399', icon: '💵', type: 'dinheiro' },
]
const CAT_TYPE_LABEL: Record<string, string> = { receita: 'Receita', despesa: 'Despesa', ambos: 'Ambos' }
const BANK_TYPE_LABEL: Record<string, string> = { conta: 'Conta', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro', investimento: 'Invest.' }

const labelStyle = { color: '#64748B' } as const
const textStyle  = { color: '#F1F5F9' } as const

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={labelStyle}>{children}</p>
}

// ─── Edit Category Modal ──────────────────────────────────────────────────────

function EditCategoryModal({ cat, onClose, onSaved }: { cat: Category | null; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [name, setName]   = useState('')
  const [type, setType]   = useState<Category['type']>('despesa')
  const [icon, setIcon]   = useState('🛒')
  const [color, setColor] = useState('#818CF8')
  const [saving, setSaving]           = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)

  useEffect(() => {
    if (cat) { setName(cat.name); setType(cat.type); setIcon(cat.icon); setColor(cat.color) }
  }, [cat])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !cat) return
    setSaving(true)
    const { error } = await supabase.from('categories').update({ name: name.trim(), type, icon, color }).eq('id', cat.id)
    setSaving(false)
    if (error) return void toast.error('Erro ao atualizar')
    toast.success('Categoria atualizada! ✨')
    onSaved(); onClose()
  }

  if (!cat) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-md rounded-t-3xl md:rounded-2xl animate-slide-up"
        style={{ background: 'rgba(13,13,26,0.99)', border: '1px solid rgba(129,140,248,0.25)' }}>
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="font-bold text-sm" style={textStyle}>Editar categoria</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl" style={{ color: '#64748B' }}><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={save} className="px-5 py-5 space-y-4">
          {/* Icon + Name */}
          <div className="flex gap-3">
            <div className="relative flex-shrink-0">
              <button type="button" onClick={() => setShowIconPicker(v => !v)}
                className="w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-colors"
                style={{ backgroundColor: color + '20', border: `2px solid ${showIconPicker ? color : 'rgba(255,255,255,0.12)'}` }}>
                {icon}
              </button>
              {showIconPicker && (
                <div className="absolute top-14 left-0 z-20 rounded-2xl shadow-2xl p-2 w-60 grid grid-cols-7 gap-1"
                  style={{ background: 'rgba(13,13,26,0.99)', border: '1px solid rgba(129,140,248,0.25)' }}>
                  {CAT_ICONS.map(em => (
                    <button key={em} type="button" onClick={() => { setIcon(em); setShowIconPicker(false) }}
                      className="aspect-square rounded-lg text-lg flex items-center justify-center transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Nome da categoria" className="input flex-1" autoFocus />
          </div>

          {/* Type */}
          <div className="flex gap-2">
            {(['despesa','receita','ambos'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className="flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all"
                style={type === t
                  ? { borderColor: color, background: color + '18', color }
                  : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8' }}>
                {CAT_TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          {/* Color */}
          <div>
            <SectionLabel>Cor</SectionLabel>
            <div className="flex gap-1.5 flex-wrap">
              {CAT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} className="w-7 h-7 rounded-full transition-all"
                  style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', transform: color === c ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Edit Bank Modal ──────────────────────────────────────────────────────────

function EditBankModal({ bank, onClose, onSaved }: { bank: Bank | null; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [name, setName]           = useState('')
  const [type, setType]           = useState<Bank['type']>('conta')
  const [color, setColor]         = useState('#818CF8')
  const [icon, setIcon]           = useState('🏦')
  const [limitAmount, setLimitAmount] = useState(0)
  const [dueDay, setDueDay]       = useState(0)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    if (bank) {
      setName(bank.name); setType(bank.type); setColor(bank.color); setIcon(bank.icon)
      setLimitAmount(bank.limit_amount || 0); setDueDay(bank.due_day || 0)
    }
  }, [bank])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !bank) return
    setSaving(true)
    const payload: any = { name: name.trim(), type, color, icon }
    if (type === 'credito') { payload.limit_amount = limitAmount || null; payload.due_day = dueDay || null }
    else { payload.limit_amount = null; payload.due_day = null }
    const { error } = await supabase.from('banks').update(payload).eq('id', bank.id)
    setSaving(false)
    if (error) return void toast.error('Erro ao atualizar')
    toast.success('Banco atualizado! ✨')
    onSaved(); onClose()
  }

  if (!bank) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-md rounded-t-3xl md:rounded-2xl animate-slide-up"
        style={{ background: 'rgba(13,13,26,0.99)', border: '1px solid rgba(129,140,248,0.25)' }}>
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="font-bold text-sm" style={textStyle}>Editar banco / cartão</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl" style={{ color: '#64748B' }}><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={save} className="px-5 py-5 space-y-4 max-h-[80dvh] overflow-y-auto">
          <div>
            <SectionLabel>Nome</SectionLabel>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" autoFocus />
          </div>

          <div>
            <SectionLabel>Tipo</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {BANK_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setType(t.value as Bank['type'])}
                  className="py-2 rounded-xl text-xs font-medium border-2 transition-all"
                  style={type === t.value
                    ? { borderColor: color, background: color + '18', color }
                    : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8' }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {type === 'credito' && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl" style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.15)' }}>
              <div>
                <SectionLabel>Limite</SectionLabel>
                <NumericFormat value={limitAmount || ''} onValueChange={v => setLimitAmount(v.floatValue || 0)}
                  thousandSeparator="." decimalSeparator="," decimalScale={2} prefix="R$ " placeholder="R$ 0,00" inputMode="decimal" className="input text-sm" />
              </div>
              <div>
                <SectionLabel>Dia vencimento</SectionLabel>
                <input type="number" min={1} max={31} value={dueDay || ''} onChange={e => setDueDay(Number(e.target.value))} placeholder="Ex: 10" className="input text-sm" />
              </div>
            </div>
          )}

          <div>
            <SectionLabel>Cor</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {[...PRESET_BANKS.map(p => p.color), '#818CF8', '#6B7280'].map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} className="w-8 h-8 rounded-full transition-all"
                  style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', transform: color === c ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
          </div>

          <button type="submit" disabled={saving} className="btn-primary w-full">
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ─── Tab 1: Perfil ────────────────────────────────────────────────────────────

function ProfileTab({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const supabase = createClient()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [name, setName]           = useState(profile?.name || '')
  const [color, setColor]         = useState(profile?.avatar_color || '#818CF8')
  const [emoji, setEmoji]         = useState(profile?.avatar_emoji || '👤')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)

  // Password change
  const [newPwd, setNewPwd]       = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)

  // Members
  const [members, setMembers]     = useState<any[]>([])

  useEffect(() => {
    setName(profile?.name || '')
    setColor(profile?.avatar_color || '#818CF8')
    setEmoji(profile?.avatar_emoji || '👤')
    setAvatarUrl(profile?.avatar_url || '')
  }, [profile])

  useEffect(() => {
    if (!profile?.household_id) return
    supabase.from('profiles').select('id, name, avatar_color, avatar_emoji, avatar_url, created_at')
      .eq('household_id', profile.household_id)
      .then(({ data }) => setMembers(data || []))
  }, [profile?.household_id])

  const uploadPhoto = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) return void toast.error('Foto muito grande! Máximo 2MB')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return void toast.error('Use JPEG, PNG ou WebP')
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop() || 'jpg'
      const path = `${profile.id}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = publicUrl + '?t=' + Date.now()
      await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
      setAvatarUrl(url)
      toast.success('Foto atualizada! 📸')
      onSaved()
    } catch (err: any) {
      toast.error(err.message?.includes('bucket') ? 'Crie o bucket "avatars" no Supabase Storage' : (err.message || 'Erro ao enviar foto'))
    } finally { setUploading(false) }
  }

  const saveProfile = async () => {
    if (!name.trim()) return void toast.error('O nome não pode ficar vazio')
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ name: name.trim(), avatar_color: color, avatar_emoji: emoji }).eq('id', profile.id)
    setSaving(false)
    if (error) return void toast.error('Erro ao salvar')
    toast.success('Perfil atualizado! ✨')
    onSaved()
  }

  const changePassword = async () => {
    if (newPwd.length < 6) return void toast.error('Senha mínima de 6 caracteres')
    setChangingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: newPwd })
    setChangingPwd(false)
    if (error) return void toast.error(error.message || 'Erro ao alterar senha')
    toast.success('Senha alterada com sucesso! 🔑')
    setNewPwd('')
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      {/* ── Left column: avatar + name + colors ── */}
      <div className="space-y-6">
      {/* Avatar preview */}
      <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="relative flex-shrink-0">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl overflow-hidden" style={{ backgroundColor: color }}>
            {avatarUrl ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : emoji}
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: '#818CF8', border: '2px solid #08080F' }}>
            {uploading ? <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Camera className="w-3 h-3 text-white" />}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />
        </div>
        <div>
          <p className="font-bold" style={textStyle}>{name || '...'}</p>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Seu avatar no app</p>
          <p className="text-[10px] mt-1" style={{ color: '#334155' }}>Foto: máx. 2MB · JPEG, PNG, WebP</p>
        </div>
      </div>

      {/* Name */}
      <div>
        <SectionLabel>Seu nome</SectionLabel>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className="input" placeholder="Jonatas ou Thuany" />
      </div>

      {/* Color */}
      <div>
        <SectionLabel>Cor do avatar</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          {AVATAR_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} className="w-9 h-9 rounded-full transition-all"
              style={{ backgroundColor: c, outline: color === c ? `3px solid ${c}` : 'none', outlineOffset: '3px', transform: color === c ? 'scale(1.2)' : 'scale(1)' }} />
          ))}
        </div>
      </div>

      {/* Emoji */}
      <div>
        <SectionLabel>Emoji do avatar</SectionLabel>
        <div className="grid grid-cols-8 gap-1.5">
          {AVATAR_EMOJIS.map(em => (
            <button key={em} onClick={() => setEmoji(em)}
              className="aspect-square rounded-xl text-xl flex items-center justify-center transition-all"
              style={emoji === em ? { outline: `2px solid ${color}`, outlineOffset: '2px', backgroundColor: color + '20' } : { background: 'rgba(255,255,255,0.04)' }}>
              {em}
            </button>
          ))}
        </div>
      </div>

      <button onClick={saveProfile} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        <Save className="w-4 h-4" />
        {saving ? 'Salvando...' : 'Salvar perfil'}
      </button>
      </div>{/* end left column */}

      {/* ── Right column: password + members ── */}
      <div className="space-y-6">

        {/* Password change */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <KeyRound className="w-4 h-4" style={{ color: '#818CF8' }} />
            <p className="font-semibold text-sm" style={textStyle}>Alterar senha</p>
          </div>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="Nova senha (mínimo 6 caracteres)"
              className="input pr-11"
            />
            <button type="button" onClick={() => setShowPwd(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1" style={{ color: '#64748B' }}>
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <button onClick={changePassword} disabled={changingPwd || newPwd.length < 6}
            className="mt-3 w-full py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
            style={{ background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.3)', color: '#818CF8' }}>
            {changingPwd ? 'Alterando...' : '🔑 Alterar senha'}
          </button>
        </div>

        {/* Household members */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4" style={{ color: '#34D399' }} />
            <p className="font-semibold text-sm" style={textStyle}>Membros do casal</p>
          </div>
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: m.avatar_color }}>
                  {m.avatar_url
                    ? <img src={m.avatar_url} alt={m.name} className="w-full h-full object-cover" />
                    : m.avatar_emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={textStyle}>{m.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3 h-3" style={{ color: '#34D399' }} />
                    <p className="text-[10px]" style={{ color: '#34D399' }}>
                      {m.id === profile?.id ? 'Você · Membro' : 'Membro'}
                    </p>
                  </div>
                </div>
                {m.id === profile?.id && (
                  <span className="text-[10px] px-2 py-1 rounded-lg" style={{ background: 'rgba(129,140,248,0.1)', color: '#818CF8' }}>
                    Você
                  </span>
                )}
              </div>
            ))}
            {members.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: '#475569' }}>Carregando membros...</p>
            )}
          </div>
          <p className="text-[10px] mt-3" style={{ color: '#334155' }}>
            Para convidar alguém ao casal, entre em contato com o suporte.
          </p>
        </div>

      </div>{/* end right column */}
    </div>
  )
}

// ─── Tab 2: Categorias ────────────────────────────────────────────────────────

function CategoriesTab({ categories, householdId, onRefresh }: { categories: Category[]; householdId: string; onRefresh: () => void }) {
  const supabase = createClient()
  const [showForm, setShowForm]         = useState(false)
  const [name, setName]                 = useState('')
  const [type, setType]                 = useState<Category['type']>('despesa')
  const [icon, setIcon]                 = useState('🛒')
  const [color, setColor]               = useState('#818CF8')
  const [saving, setSaving]             = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)
  const [editingCat, setEditingCat]     = useState<Category | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null)

  const resetForm = () => { setName(''); setType('despesa'); setIcon('🛒'); setColor('#818CF8'); setShowForm(false); setShowIconPicker(false) }

  const addCategory = async () => {
    if (!name.trim()) return void toast.error('Digite um nome')
    setSaving(true)
    const { error } = await supabase.from('categories').insert({ household_id: householdId, name: name.trim(), type, icon, color, is_default: false })
    setSaving(false)
    if (error) return void toast.error('Erro ao adicionar')
    toast.success('Categoria adicionada!'); resetForm(); onRefresh()
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    const { error } = await supabase.from('categories').delete().eq('id', confirmDelete.id)
    if (error) toast.error('Não foi possível excluir — existem transações nesta categoria')
    else { toast.success('Categoria removida'); onRefresh() }
    setConfirmDelete(null)
  }

  const grouped = {
    receita: categories.filter(c => c.type === 'receita'),
    despesa: categories.filter(c => c.type === 'despesa'),
    ambos:   categories.filter(c => c.type === 'ambos'),
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ── Left: existing categories ── */}
        <div className="space-y-4">
      {(['receita','despesa','ambos'] as const).map(t => grouped[t].length > 0 && (
        <div key={t}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#475569' }}>{CAT_TYPE_LABEL[t]}</p>
          <div className="space-y-2">
            {grouped[t].map(cat => (
              <div key={cat.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: cat.color + '25' }}>{cat.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={textStyle}>{cat.name}</p>
                  {cat.is_default && <p className="text-[10px]" style={{ color: '#334155' }}>padrão</p>}
                </div>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setEditingCat(cat)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#818CF8' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setConfirmDelete(cat)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#475569' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent' }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
        </div>{/* end left col */}

        {/* ── Right: add form always visible ── */}
        <div className="card space-y-4" style={{ border: '1px solid rgba(129,140,248,0.2)' }}>
          <p className="font-semibold text-sm" style={textStyle}>Nova categoria</p>
          <div className="flex gap-3">
            <div className="relative flex-shrink-0">
              <button type="button" onClick={() => setShowIconPicker(v => !v)}
                className="w-12 h-12 rounded-xl text-2xl flex items-center justify-center transition-colors"
                style={{ backgroundColor: color + '20', border: `2px solid ${showIconPicker ? color : 'rgba(255,255,255,0.1)'}` }}>
                {icon}
              </button>
              {showIconPicker && (
                <div className="absolute top-14 left-0 z-20 rounded-2xl shadow-2xl p-2 w-60 grid grid-cols-7 gap-1"
                  style={{ background: 'rgba(13,13,26,0.99)', border: '1px solid rgba(129,140,248,0.25)' }}>
                  {CAT_ICONS.map(em => (
                    <button key={em} type="button" onClick={() => { setIcon(em); setShowIconPicker(false) }}
                      className="aspect-square rounded-lg text-lg flex items-center justify-center transition-colors"
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.12)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nome da categoria" className="input" />
          </div>
          <div className="flex gap-2">
            {(['despesa','receita','ambos'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all"
                style={type === t
                  ? { borderColor: '#818CF8', background: 'rgba(129,140,248,0.12)', color: '#818CF8' }
                  : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8' }}>
                {CAT_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <div>
            <SectionLabel>Cor</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {CAT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)} className="w-8 h-8 rounded-full transition-all"
                  style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', transform: color === c ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
          </div>
          <button onClick={addCategory} disabled={saving} className="btn-primary w-full">
            {saving ? 'Salvando...' : '+ Adicionar categoria'}
          </button>
        </div>
      </div>{/* end grid */}

      <EditCategoryModal cat={editingCat} onClose={() => setEditingCat(null)} onSaved={onRefresh} />
      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir categoria?"
        message={confirmDelete
          ? confirmDelete.is_default
            ? `"${confirmDelete.name}" é uma categoria padrão. Transações perderão a categoria. Tem certeza?`
            : `A categoria "${confirmDelete.name}" será excluída permanentemente.`
          : ''}
        confirmLabel="Excluir"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

// ─── Tab 3: Bancos ────────────────────────────────────────────────────────────

function BanksTab({ banks, householdId, onRefresh }: { banks: Bank[]; householdId: string; onRefresh: () => void }) {
  const supabase = createClient()
  const [name, setName]             = useState('')
  const [type, setType]             = useState<Bank['type']>('conta')
  const [color, setColor]           = useState('#818CF8')
  const [icon, setIcon]             = useState('🏦')
  const [limitAmount, setLimitAmount] = useState(0)
  const [dueDay, setDueDay]         = useState(0)
  const [saving, setSaving]         = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Bank | null>(null)
  const [editingBank, setEditingBank]     = useState<Bank | null>(null)

  const resetForm = () => { setName(''); setType('conta'); setColor('#818CF8'); setIcon('🏦'); setLimitAmount(0); setDueDay(0) }

  const applyPreset = (p: typeof PRESET_BANKS[0]) => {
    setName(p.name); setColor(p.color); setIcon(p.icon); setType(p.type as Bank['type'])
  }

  const addBank = async () => {
    if (!name.trim()) return void toast.error('Digite um nome')
    setSaving(true)
    const payload: any = { household_id: householdId, name: name.trim(), type, color, icon, is_default: false }
    if (type === 'credito') { payload.limit_amount = limitAmount || null; payload.due_day = dueDay || null }
    const { error } = await supabase.from('banks').insert(payload)
    setSaving(false)
    if (error) return void toast.error('Erro ao adicionar')
    toast.success('Banco adicionado!'); resetForm(); onRefresh()
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    const { error } = await supabase.from('banks').delete().eq('id', confirmDelete.id)
    if (error) toast.error('Não foi possível excluir — existem transações neste banco')
    else { toast.success('Banco removido'); onRefresh() }
    setConfirmDelete(null)
  }

  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left — bank list */}
      <div className="card space-y-3" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <p className="font-semibold text-sm" style={textStyle}>Bancos e cartões ({banks.length})</p>
        <div className="space-y-2">
          {banks.map(bank => (
            <div key={bank.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: bank.color + '20' }}>{bank.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={textStyle}>{bank.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{ backgroundColor: bank.color + '20', color: bank.color }}>
                    {BANK_TYPE_LABEL[bank.type]}
                  </span>
                  {bank.limit_amount && <span className="text-[10px]" style={{ color: '#475569' }}>Limite: {brl(bank.limit_amount)}</span>}
                  {bank.due_day && <span className="text-[10px]" style={{ color: '#475569' }}>Venc: dia {bank.due_day}</span>}
                  {bank.is_default && <span className="text-[10px]" style={{ color: '#334155' }}>padrão</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setEditingBank(bank)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: '#818CF8' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setConfirmDelete(bank)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: '#475569' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent' }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {banks.length === 0 && <p className="text-sm text-center py-4" style={{ color: '#475569' }}>Nenhum banco cadastrado</p>}
        </div>
      </div>

      {/* Right — add form always visible */}
      <div className="card space-y-4" style={{ border: '1px solid rgba(129,140,248,0.2)' }}>
        <p className="font-semibold text-sm" style={textStyle}>Novo banco / cartão</p>
        <div>
          <SectionLabel>Atalhos rápidos</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {PRESET_BANKS.map(p => (
              <button key={p.name} type="button" onClick={() => applyPreset(p)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={name === p.name
                  ? { border: `1px solid ${p.color}`, color: p.color, background: p.color + '12' }
                  : { border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8', background: 'rgba(255,255,255,0.04)' }}>
                <span>{p.icon}</span>{p.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <SectionLabel>Nome</SectionLabel>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Nubank, Inter, BB..." className="input" />
        </div>
        <div>
          <SectionLabel>Tipo</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {BANK_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setType(t.value as Bank['type'])}
                className="py-2 rounded-xl text-xs font-medium border-2 transition-all"
                style={type === t.value
                  ? { borderColor: '#818CF8', background: 'rgba(129,140,248,0.12)', color: '#818CF8' }
                  : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#94A3B8' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        {type === 'credito' && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl" style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.15)' }}>
            <div>
              <SectionLabel>Limite do cartão</SectionLabel>
              <NumericFormat value={limitAmount || ''} onValueChange={v => setLimitAmount(v.floatValue || 0)}
                thousandSeparator="." decimalSeparator="," decimalScale={2} prefix="R$ " placeholder="R$ 0,00" inputMode="decimal" className="input text-sm" />
            </div>
            <div>
              <SectionLabel>Dia de vencimento</SectionLabel>
              <input type="number" min={1} max={31} value={dueDay || ''} onChange={e => setDueDay(Number(e.target.value))} placeholder="Ex: 10" className="input text-sm" />
            </div>
          </div>
        )}
        <div>
          <SectionLabel>Cor</SectionLabel>
          <div className="flex gap-2 flex-wrap">
            {[...PRESET_BANKS.map(p => p.color), '#818CF8', '#6B7280'].map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} className="w-8 h-8 rounded-full transition-all"
                style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', transform: color === c ? 'scale(1.2)' : 'scale(1)' }} />
            ))}
          </div>
        </div>
        <button onClick={addBank} disabled={saving} className="btn-primary w-full text-sm">
          {saving ? 'Salvando...' : 'Adicionar'}
        </button>
      </div>

      <EditBankModal bank={editingBank} onClose={() => setEditingBank(null)} onSaved={onRefresh} />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir banco?"
        message={confirmDelete ? `"${confirmDelete.name}" será excluído. Isso pode falhar se houver transações vinculadas.` : ''}
        confirmLabel="Excluir"
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}

// ─── Tab 4: Orçamentos ────────────────────────────────────────────────────────

function BudgetsTab({ categories, householdId }: { categories: Category[]; householdId: string }) {
  const supabase = createClient()
  const [currentDate] = useState(new Date())
  const [budgetValues, setBudgetValues] = useState<Record<string, string>>({})
  const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>({})
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmClear, setConfirmClear] = useState<Category | null>(null)

  const currentMonth = currentDate.getMonth() + 1
  const currentYear  = currentDate.getFullYear()

  const loadData = useCallback(async () => {
    setLoading(true)
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end   = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const [budgetsRes, txRes] = await Promise.all([
      supabase.from('budgets').select('*').eq('household_id', householdId).eq('month', currentMonth).eq('year', currentYear),
      supabase.from('transactions').select('category_id, amount, type, status').eq('household_id', householdId).eq('status', 'realizado').neq('type', 'receita').gte('date', start).lte('date', end),
    ])
    const vals: Record<string, string> = {}
    for (const b of (budgetsRes.data || []) as Budget[]) vals[b.category_id] = String(b.amount)
    setBudgetValues(vals)
    const spent: Record<string, number> = {}
    for (const tx of (txRes.data || [])) { if (!tx.category_id) continue; spent[tx.category_id] = (spent[tx.category_id] || 0) + Number(tx.amount) }
    setSpentByCategory(spent)
    setLoading(false)
  }, [householdId, currentMonth, currentYear])

  useEffect(() => { loadData() }, [loadData])

  const clearBudget = async () => {
    if (!confirmClear) return
    await supabase.from('budgets').delete()
      .eq('household_id', householdId).eq('category_id', confirmClear.id)
      .eq('month', currentMonth).eq('year', currentYear)
    setBudgetValues(prev => { const next = { ...prev }; delete next[confirmClear.id]; return next })
    toast.success('Orçamento removido')
    setConfirmClear(null)
  }

  const saveAll = async () => {
    setSaving(true)
    let hasError = false
    for (const [catId, val] of Object.entries(budgetValues)) {
      const amount = parseFloat(val.replace(',', '.'))
      if (isNaN(amount) || amount < 0) continue
      if (amount === 0) { await supabase.from('budgets').delete().eq('household_id', householdId).eq('category_id', catId).eq('month', currentMonth).eq('year', currentYear); continue }
      const { error } = await supabase.from('budgets').upsert({ household_id: householdId, category_id: catId, month: currentMonth, year: currentYear, amount }, { onConflict: 'household_id,category_id,month,year' })
      if (error) hasError = true
    }
    setSaving(false)
    if (hasError) { toast.error('Alguns orçamentos não foram salvos'); return }
    toast.success('Orçamentos salvos! 💰')
    loadData()
  }

  const expenseCategories = categories.filter(c => c.type === 'despesa' || c.type === 'ambos')
  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold" style={textStyle}>{format(currentDate, 'MMMM yyyy', { locale: ptBR })}</p>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Defina o limite mensal por categoria</p>
        </div>
      </div>

      {expenseCategories.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: '#475569' }}>Adicione categorias de despesa primeiro</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {expenseCategories.map(cat => {
            const budget = parseFloat((budgetValues[cat.id] || '0').replace(',', '.')) || 0
            const spent  = spentByCategory[cat.id] || 0
            const pct    = budget > 0 ? Math.round((spent / budget) * 100) : 0
            const over   = budget > 0 && spent > budget
            const warn   = budget > 0 && pct >= 80 && !over
            let barColor = '#34D399'
            if (pct >= 100) barColor = '#F87171'
            else if (pct >= 80) barColor = '#FB923C'
            else if (pct >= 60) barColor = '#FBBF24'

            return (
              <div key={cat.id} className="rounded-2xl p-4"
                style={{ background: over ? 'rgba(248,113,113,0.06)' : warn ? 'rgba(251,191,36,0.06)' : 'rgba(255,255,255,0.04)',
                  border: over ? '1px solid rgba(248,113,113,0.25)' : warn ? '1px solid rgba(251,191,36,0.25)' : '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                    style={{ backgroundColor: cat.color + '25' }}>{cat.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={textStyle}>{cat.name}</p>
                      {over && <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.15)', color: '#F87171' }}><AlertTriangle className="w-2.5 h-2.5" />Excedeu!</span>}
                      {warn && <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.15)', color: '#FBBF24' }}><AlertTriangle className="w-2.5 h-2.5" />{pct}%</span>}
                    </div>
                    {budget > 0 && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>R$ {fmt(spent)} de R$ {fmt(budget)} usados</p>}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <NumericFormat
                      value={budgetValues[cat.id] || ''}
                      onValueChange={v => setBudgetValues(prev => ({ ...prev, [cat.id]: v.value }))}
                      thousandSeparator="." decimalSeparator="," decimalScale={2}
                      prefix="R$ " placeholder="Sem limite" inputMode="decimal"
                      className="w-28 text-right text-sm font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none transition-all"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#F1F5F9' }}
                    />
                    {budget > 0 && (
                      <button onClick={() => setConfirmClear(cat)}
                        className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                        style={{ color: '#475569' }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#F87171'; e.currentTarget.style.background = 'rgba(248,113,113,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = 'transparent' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {budget > 0 && (
                  <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {expenseCategories.length > 0 && (
        <button onClick={saveAll} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar orçamentos'}
        </button>
      )}

      <ConfirmDialog
        open={!!confirmClear}
        title="Remover orçamento?"
        message={confirmClear ? `O limite mensal de "${confirmClear.name}" será removido.` : ''}
        confirmLabel="Remover"
        onConfirm={clearBudget}
        onCancel={() => setConfirmClear(null)}
      />
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'users' | 'security' | 'categories' | 'banks' | 'budgets'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'profile',    label: 'Perfil',     icon: '👤' },
  { id: 'users',      label: 'Usuários',    icon: '🛡️' },
  { id: 'security',   label: 'Segurança',   icon: '🔐' },
  { id: 'categories', label: 'Categorias', icon: '🏷️' },
  { id: 'banks',      label: 'Bancos',     icon: '🏦' },
  { id: 'budgets',    label: 'Orçamentos', icon: '📊' },
]

export default function SettingsPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab]   = useState<Tab>('profile')
  const [profile, setProfile]       = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [banks, setBanks]           = useState<Bank[]>([])
  const [loading, setLoading]       = useState(true)

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    if (!prof?.household_id) { setLoading(false); return }
    const hid = prof.household_id
    const [cRes, bRes] = await Promise.all([
      supabase.from('categories').select('*').eq('household_id', hid).order('name'),
      supabase.from('banks').select('*').eq('household_id', hid).order('name'),
    ])
    setCategories(cRes.data || [])
    setBanks(bRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  return (
    <AppLayout profile={profile}>
      <div className="pb-28 md:pb-8">
        <div className="mb-5">
          <h1 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>Configurações</h1>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Personalize o app do casal</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-2xl mb-6 overflow-x-auto"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all min-w-fit"
              style={activeTab === tab.id
                ? { background: 'rgba(129,140,248,0.18)', color: '#818CF8', border: '1px solid rgba(129,140,248,0.3)' }
                : { color: '#64748B' }}>
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3 max-w-sm">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
        ) : (
          <div className="animate-fade-in">
            {activeTab === 'profile'    && <ProfileTab profile={profile} onSaved={fetchAll} />}
            {activeTab === 'users'      && <UserAdminTab profile={profile as Profile | null} />}
            {activeTab === 'security'   && <SecurityTab />}
            {activeTab === 'categories' && <CategoriesTab categories={categories} householdId={profile?.household_id || ''} onRefresh={fetchAll} />}
            {activeTab === 'banks'      && <BanksTab banks={banks} householdId={profile?.household_id || ''} onRefresh={fetchAll} />}
            {activeTab === 'budgets'    && <BudgetsTab categories={categories} householdId={profile?.household_id || ''} />}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
