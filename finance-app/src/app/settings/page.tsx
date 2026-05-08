'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { NumericFormat } from 'react-number-format'
import { toast } from 'sonner'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Trash2, Plus, Save, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import type { Category, Bank, Budget } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#6366F1','#EC4899','#10B981','#F59E0B','#EF4444','#8B5CF6','#0EA5E9','#F97316',
]
const AVATAR_EMOJIS = [
  '👤','😊','🥰','😎','🤩','🧔','👩','🦸','🐶','🐱','🦊','🐯','🦁','🐻','🐼','🌻',
]
const CAT_ICONS = [
  '🛒','🍕','🍺','☕','🚗','🏠','💡','💊','👕','📱','🎬','✈️','🎓','📚','🎮','🎁',
  '🏋️','🎵','🐾','🌿','💄','🚌','🔧','🏦','💳','💰','📊','🍔',
]
const CAT_COLORS = [
  '#6366F1','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#0EA5E9','#F97316',
  '#14B8A6','#84CC16','#F43F5E','#A855F7','#06B6D4','#D97706','#6B7280','#1D4ED8',
]
const BANK_TYPES = [
  { value: 'conta',        label: 'Conta corrente' },
  { value: 'credito',      label: 'Cartão crédito' },
  { value: 'debito',       label: 'Cartão débito'  },
  { value: 'dinheiro',     label: 'Dinheiro'       },
  { value: 'investimento', label: 'Investimento'   },
]
const PRESET_BANKS = [
  { name: 'Nubank',    color: '#8A05BE', icon: '💜', type: 'credito'  },
  { name: 'Inter',     color: '#FF6B35', icon: '🧡', type: 'conta'    },
  { name: 'BB',        color: '#F7C948', icon: '🟡', type: 'conta'    },
  { name: 'Itaú',      color: '#EC7000', icon: '🟠', type: 'conta'    },
  { name: 'Bradesco',  color: '#CC092F', icon: '🔴', type: 'conta'    },
  { name: 'Caixa',     color: '#005CA9', icon: '💙', type: 'conta'    },
  { name: 'Dinheiro',  color: '#10B981', icon: '💵', type: 'dinheiro' },
]
const CAT_TYPE_LABEL: Record<string, string> = {
  receita: 'Receita', despesa: 'Despesa', ambos: 'Ambos',
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
      {children}
    </p>
  )
}

// ─── Tab 1: Perfil ────────────────────────────────────────────────────────────

function ProfileTab({ profile, onSaved }: { profile: any; onSaved: () => void }) {
  const supabase = createClient()
  const [name, setName] = useState(profile?.name || '')
  const [color, setColor] = useState(profile?.avatar_color || '#6366F1')
  const [emoji, setEmoji] = useState(profile?.avatar_emoji || '👤')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(profile?.name || '')
    setColor(profile?.avatar_color || '#6366F1')
    setEmoji(profile?.avatar_emoji || '👤')
  }, [profile])

  const save = async () => {
    if (!name.trim()) return void toast.error('O nome não pode ficar vazio')
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), avatar_color: color, avatar_emoji: emoji })
      .eq('id', profile.id)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar'); return }
    toast.success('Perfil atualizado! ✨')
    onSaved()
  }

  return (
    <div className="space-y-6 max-w-sm">
      {/* Preview */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-sm flex-shrink-0"
          style={{ backgroundColor: color }}
        >
          {emoji}
        </div>
        <div>
          <p className="font-bold text-gray-900">{name || '...'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Seu avatar no app</p>
        </div>
      </div>

      {/* Nome */}
      <div>
        <SectionLabel>Seu nome</SectionLabel>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="input"
          placeholder="Jonatas ou Thuany"
        />
      </div>

      {/* Cor */}
      <div>
        <SectionLabel>Cor do avatar</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          {AVATAR_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-9 h-9 rounded-full transition-all duration-150"
              style={{
                backgroundColor: c,
                outline: color === c ? `3px solid ${c}` : 'none',
                outlineOffset: '3px',
                transform: color === c ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Emoji */}
      <div>
        <SectionLabel>Emoji do avatar</SectionLabel>
        <div className="grid grid-cols-8 gap-1.5">
          {AVATAR_EMOJIS.map(em => (
            <button
              key={em}
              onClick={() => setEmoji(em)}
              className="aspect-square rounded-xl text-xl flex items-center justify-center transition-all duration-150 hover:bg-gray-100"
              style={emoji === em ? { outline: `2px solid ${color}`, outlineOffset: '2px', backgroundColor: color + '20' } : {}}
            >
              {em}
            </button>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        <Save className="w-4 h-4" />
        {saving ? 'Salvando...' : 'Salvar perfil'}
      </button>
    </div>
  )
}

// ─── Tab 2: Categorias ────────────────────────────────────────────────────────

function CategoriesTab({ categories, householdId, onRefresh }: {
  categories: Category[]
  householdId: string
  onRefresh: () => void
}) {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'receita' | 'despesa' | 'ambos'>('despesa')
  const [icon, setIcon] = useState('🛒')
  const [color, setColor] = useState('#6366F1')
  const [saving, setSaving] = useState(false)
  const [showIconPicker, setShowIconPicker] = useState(false)

  const resetForm = () => { setName(''); setType('despesa'); setIcon('🛒'); setColor('#6366F1'); setShowForm(false); setShowIconPicker(false) }

  const addCategory = async () => {
    if (!name.trim()) return void toast.error('Digite um nome')
    setSaving(true)
    const { error } = await supabase.from('categories').insert({
      household_id: householdId, name: name.trim(), type, icon, color, is_default: false,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao adicionar'); return }
    toast.success('Categoria adicionada!')
    resetForm()
    onRefresh()
  }

  const deleteCategory = async (cat: Category) => {
    const { error } = await supabase.from('categories').delete().eq('id', cat.id)
    if (error) {
      toast.error('Não foi possível deletar — existem transações nesta categoria')
      return
    }
    toast.success('Categoria removida')
    onRefresh()
  }

  const grouped = {
    receita: categories.filter(c => c.type === 'receita'),
    despesa: categories.filter(c => c.type === 'despesa'),
    ambos:   categories.filter(c => c.type === 'ambos'),
  }

  return (
    <div className="space-y-4 max-w-lg">
      {/* List */}
      {(['receita','despesa','ambos'] as const).map(t => (
        grouped[t].length > 0 && (
          <div key={t}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              {CAT_TYPE_LABEL[t]}
            </p>
            <div className="space-y-2">
              {grouped[t].map(cat => (
                <div key={cat.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-card">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: cat.color + '25' }}>
                    {cat.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{cat.name}</p>
                    {cat.is_default && <p className="text-[10px] text-gray-400">padrão</p>}
                  </div>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  {!cat.is_default && (
                    <button
                      onClick={() => deleteCategory(cat)}
                      className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {/* Add button */}
      <button
        onClick={() => setShowForm(v => !v)}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-all duration-150"
      >
        {showForm ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {showForm ? 'Cancelar' : 'Adicionar categoria'}
      </button>

      {/* Add form */}
      {showForm && (
        <div className="card border border-primary-100 bg-primary-50/30 space-y-4 animate-fade-in">
          <p className="font-semibold text-gray-800 text-sm">Nova categoria</p>

          <div className="flex gap-2">
            {/* Icon button */}
            <div className="relative">
              <button
                onClick={() => setShowIconPicker(v => !v)}
                className="w-12 h-10 rounded-xl border-2 border-gray-200 text-xl flex items-center justify-center hover:border-primary-300 transition-colors"
                style={{ backgroundColor: color + '20', borderColor: showIconPicker ? color : undefined }}
              >
                {icon}
              </button>
              {showIconPicker && (
                <div className="absolute top-12 left-0 z-20 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 w-56 grid grid-cols-7 gap-1">
                  {CAT_ICONS.map(em => (
                    <button key={em} onClick={() => { setIcon(em); setShowIconPicker(false) }}
                      className="aspect-square rounded-lg text-lg flex items-center justify-center hover:bg-gray-100 transition-colors">
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Nome da categoria" className="input flex-1" />
          </div>

          {/* Tipo */}
          <div className="flex gap-2">
            {(['despesa','receita','ambos'] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border-2 transition-all duration-150
                  ${type === t ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                {CAT_TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          {/* Cores */}
          <div>
            <SectionLabel>Cor</SectionLabel>
            <div className="flex gap-1.5 flex-wrap">
              {CAT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full transition-all duration-150"
                  style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', transform: color === c ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
          </div>

          <button onClick={addCategory} disabled={saving} className="btn-primary w-full text-sm">
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab 3: Bancos ────────────────────────────────────────────────────────────

function BanksTab({ banks, householdId, onRefresh }: {
  banks: Bank[]
  householdId: string
  onRefresh: () => void
}) {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<Bank['type']>('conta')
  const [color, setColor] = useState('#6366F1')
  const [icon, setIcon] = useState('🏦')
  const [saving, setSaving] = useState(false)

  const resetForm = () => { setName(''); setType('conta'); setColor('#6366F1'); setIcon('🏦'); setShowForm(false) }

  const applyPreset = (p: typeof PRESET_BANKS[0]) => {
    setName(p.name); setColor(p.color); setIcon(p.icon); setType(p.type as Bank['type'])
  }

  const addBank = async () => {
    if (!name.trim()) return void toast.error('Digite um nome')
    setSaving(true)
    const { error } = await supabase.from('banks').insert({
      household_id: householdId, name: name.trim(), type, color, icon, is_default: false,
    })
    setSaving(false)
    if (error) { toast.error('Erro ao adicionar'); return }
    toast.success('Banco adicionado!')
    resetForm()
    onRefresh()
  }

  const deleteBank = async (bank: Bank) => {
    const { error } = await supabase.from('banks').delete().eq('id', bank.id)
    if (error) {
      toast.error('Não foi possível deletar — existem transações neste banco')
      return
    }
    toast.success('Banco removido')
    onRefresh()
  }

  const BANK_TYPE_LABEL: Record<string, string> = {
    conta: 'Conta', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro', investimento: 'Invest.',
  }

  return (
    <div className="space-y-4 max-w-lg">
      {/* List */}
      <div className="space-y-2">
        {banks.map(bank => (
          <div key={bank.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5 shadow-card">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: bank.color + '20' }}>
              {bank.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{bank.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: bank.color + '20', color: bank.color }}>
                  {BANK_TYPE_LABEL[bank.type]}
                </span>
                {bank.is_default && <span className="text-[10px] text-gray-400">padrão</span>}
              </div>
            </div>
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: bank.color }} />
            {!bank.is_default && (
              <button onClick={() => deleteBank(bank)}
                className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
        {banks.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">Nenhum banco cadastrado</p>
        )}
      </div>

      {/* Add button */}
      <button
        onClick={() => setShowForm(v => !v)}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-500 hover:border-primary-300 hover:text-primary-600 transition-all duration-150"
      >
        {showForm ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        {showForm ? 'Cancelar' : 'Adicionar banco / cartão'}
      </button>

      {/* Add form */}
      {showForm && (
        <div className="card border border-primary-100 bg-primary-50/30 space-y-4 animate-fade-in">
          <p className="font-semibold text-gray-800 text-sm">Novo banco / cartão</p>

          {/* Presets */}
          <div>
            <SectionLabel>Atalhos rápidos</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {PRESET_BANKS.map(p => (
                <button
                  key={p.name}
                  onClick={() => applyPreset(p)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all duration-150"
                  style={{ borderColor: name === p.name ? p.color : undefined, color: name === p.name ? p.color : undefined }}
                >
                  <span>{p.icon}</span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div>
            <SectionLabel>Nome</SectionLabel>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Ex: Nubank, Inter, Caixa..." className="input" />
          </div>

          {/* Tipo */}
          <div>
            <SectionLabel>Tipo</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {BANK_TYPES.map(t => (
                <button key={t.value} onClick={() => setType(t.value as Bank['type'])}
                  className={`py-2 rounded-xl text-xs font-medium border-2 transition-all duration-150
                    ${type === t.value ? 'border-primary-400 bg-primary-50 text-primary-700' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cor */}
          <div>
            <SectionLabel>Cor</SectionLabel>
            <div className="flex gap-2 flex-wrap">
              {[...PRESET_BANKS.map(p => p.color), '#6366F1','#6B7280'].map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition-all duration-150"
                  style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: '2px', transform: color === c ? 'scale(1.2)' : 'scale(1)' }} />
              ))}
            </div>
          </div>

          <button onClick={addBank} disabled={saving} className="btn-primary w-full text-sm">
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab 4: Orçamentos ────────────────────────────────────────────────────────

function BudgetsTab({ categories, householdId }: {
  categories: Category[]
  householdId: string
}) {
  const supabase = createClient()
  const [currentDate] = useState(new Date())
  const [budgetValues, setBudgetValues] = useState<Record<string, string>>({})
  const [spentByCategory, setSpentByCategory] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

  const loadData = useCallback(async () => {
    setLoading(true)
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const [budgetsRes, txRes] = await Promise.all([
      supabase
        .from('budgets')
        .select('*')
        .eq('household_id', householdId)
        .eq('month', currentMonth)
        .eq('year', currentYear),
      supabase
        .from('transactions')
        .select('category_id, amount, type, status')
        .eq('household_id', householdId)
        .eq('status', 'realizado')
        .neq('type', 'receita')
        .gte('date', start)
        .lte('date', end),
    ])

    const vals: Record<string, string> = {}
    for (const b of (budgetsRes.data || []) as Budget[]) {
      vals[b.category_id] = String(b.amount)
    }
    setBudgetValues(vals)

    const spent: Record<string, number> = {}
    for (const tx of (txRes.data || [])) {
      if (!tx.category_id) continue
      spent[tx.category_id] = (spent[tx.category_id] || 0) + Number(tx.amount)
    }
    setSpentByCategory(spent)
    setLoading(false)
  }, [householdId, currentMonth, currentYear])

  useEffect(() => { loadData() }, [loadData])

  const saveAll = async () => {
    setSaving(true)
    let hasError = false

    for (const [catId, val] of Object.entries(budgetValues)) {
      const amount = parseFloat(val.replace(',', '.'))
      if (isNaN(amount) || amount < 0) continue

      if (amount === 0) {
        await supabase
          .from('budgets')
          .delete()
          .eq('household_id', householdId)
          .eq('category_id', catId)
          .eq('month', currentMonth)
          .eq('year', currentYear)
        continue
      }

      const { error } = await supabase.from('budgets').upsert({
        household_id: householdId,
        category_id: catId,
        month: currentMonth,
        year: currentYear,
        amount,
      }, { onConflict: 'household_id,category_id,month,year' })

      if (error) { hasError = true }
    }

    setSaving(false)
    if (hasError) { toast.error('Alguns orçamentos não foram salvos'); return }
    toast.success('Orçamentos salvos! 💰')
    loadData()
  }

  const expenseCategories = categories.filter(c => c.type === 'despesa' || c.type === 'ambos')

  const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  if (loading) {
    return (
      <div className="space-y-3 max-w-lg">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton h-20 rounded-2xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-800">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Defina o limite mensal por categoria
          </p>
        </div>
      </div>

      {expenseCategories.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          Adicione categorias de despesa primeiro
        </p>
      ) : (
        <div className="space-y-3">
          {expenseCategories.map(cat => {
            const budget = parseFloat((budgetValues[cat.id] || '0').replace(',', '.')) || 0
            const spent = spentByCategory[cat.id] || 0
            const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
            const overBudget = budget > 0 && spent > budget
            const warning = budget > 0 && pct >= 80 && !overBudget

            let barColor = '#10B981'
            if (pct >= 100) barColor = '#EF4444'
            else if (pct >= 80) barColor = '#F97316'
            else if (pct >= 60) barColor = '#F59E0B'

            return (
              <div key={cat.id}
                className={`bg-white rounded-2xl border shadow-card p-4 transition-all duration-150
                  ${overBudget ? 'border-red-200 bg-red-50/30' : warning ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100/50'}`}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0" style={{ backgroundColor: cat.color + '25' }}>
                    {cat.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{cat.name}</p>
                      {overBudget && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Excedeu!
                        </span>
                      )}
                      {warning && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {pct}%
                        </span>
                      )}
                    </div>
                    {budget > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        R$ {fmt(spent)} de R$ {fmt(budget)} usados
                      </p>
                    )}
                  </div>

                  {/* Budget input */}
                  <div className="flex-shrink-0">
                    <NumericFormat
                      value={budgetValues[cat.id] || ''}
                      onValueChange={v => setBudgetValues(prev => ({ ...prev, [cat.id]: v.value }))}
                      thousandSeparator="." decimalSeparator="," decimalScale={2}
                      prefix="R$ " placeholder="Sem limite"
                      inputMode="decimal"
                      className="w-32 text-right text-sm font-semibold bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all"
                    />
                  </div>
                </div>

                {/* Progress bar */}
                {budget > 0 && (
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, pct)}%`, backgroundColor: barColor }}
                    />
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
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'profile' | 'categories' | 'banks' | 'budgets'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'profile',    label: 'Perfil',      icon: '👤' },
  { id: 'categories', label: 'Categorias',  icon: '🏷️' },
  { id: 'banks',      label: 'Bancos',      icon: '🏦' },
  { id: 'budgets',    label: 'Orçamentos',  icon: '📊' },
]

export default function SettingsPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [profile, setProfile] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
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
          <h1 className="text-lg font-bold text-gray-900">Configurações</h1>
          <p className="text-xs text-gray-400 mt-0.5">Personalize o app do casal</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-6 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-150 min-w-fit
                ${activeTab === tab.id
                  ? 'bg-white text-gray-900 shadow-card'
                  : 'text-gray-500 hover:text-gray-700'}`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {loading ? (
          <div className="space-y-3 max-w-sm">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
          </div>
        ) : (
          <div className="animate-fade-in">
            {activeTab === 'profile' && (
              <ProfileTab profile={profile} onSaved={fetchAll} />
            )}
            {activeTab === 'categories' && (
              <CategoriesTab
                categories={categories}
                householdId={profile?.household_id || ''}
                onRefresh={fetchAll}
              />
            )}
            {activeTab === 'banks' && (
              <BanksTab
                banks={banks}
                householdId={profile?.household_id || ''}
                onRefresh={fetchAll}
              />
            )}
            {activeTab === 'budgets' && (
              <BudgetsTab
                categories={categories}
                householdId={profile?.household_id || ''}
              />
            )}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
