'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Search, Trash2, X, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import type { Transaction, Category, Bank, TransactionType, Profile } from '@/types'

// ─── Transaction row with swipe-to-delete ───────────────────────────────────

const TYPE_STYLE: Record<TransactionType, { bg: string; color: string; sign: string }> = {
  receita:       { bg: 'bg-emerald-100', color: 'text-emerald-600', sign: '+' },
  despesa:       { bg: 'bg-red-100',     color: 'text-red-500',     sign: '-' },
  fatura:        { bg: 'bg-orange-100',  color: 'text-orange-500',  sign: '-' },
  transferencia: { bg: 'bg-blue-100',    color: 'text-blue-500',    sign: ''  },
}

const STATUS_BADGE: Record<string, string> = {
  realizado: 'badge badge-done',
  pendente:  'badge badge-pending',
  agendado:  'badge badge-pending',
}

const STATUS_LABEL: Record<string, string> = {
  realizado: 'Realizado',
  pendente:  'Pendente',
  agendado:  'Agendado',
}

function TransactionRow({
  tx,
  onDelete,
}: {
  tx: Transaction
  onDelete: () => void
}) {
  const [offsetX, setOffsetX] = useState(0)
  const [touching, setTouching] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const direction = useRef<'h' | 'v' | null>(null)
  const MAX_SWIPE = 80
  const SNAP_THRESHOLD = 52

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    direction.current = null
    setTouching(true)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const dx = startX.current - e.touches[0].clientX
    const dy = Math.abs(startY.current - e.touches[0].clientY)

    if (direction.current === null) {
      if (Math.abs(dx) > 6 || dy > 6) {
        direction.current = Math.abs(dx) >= dy ? 'h' : 'v'
      }
      return
    }
    if (direction.current !== 'h') return

    if (dx < 0) { setOffsetX(0); return }
    setOffsetX(Math.min(dx, MAX_SWIPE))
  }

  const onTouchEnd = () => {
    setTouching(false)
    direction.current = null
    setOffsetX(prev => (prev >= SNAP_THRESHOLD ? MAX_SWIPE : 0))
  }

  const ts = TYPE_STYLE[tx.type] ?? TYPE_STYLE.despesa

  return (
    <div className="relative overflow-hidden rounded-2xl mb-2">
      {/* Delete action revealed on swipe */}
      <div className="absolute inset-y-0 right-0 w-20 bg-red-500 rounded-r-2xl flex items-center justify-center">
        <button
          onClick={onDelete}
          className="flex flex-col items-center gap-1 text-white w-full h-full justify-center"
        >
          <Trash2 className="w-5 h-5" />
          <span className="text-xs font-medium">Apagar</span>
        </button>
      </div>

      {/* Main card */}
      <div
        className="relative bg-white rounded-2xl shadow-card border border-gray-100/50 p-4 z-10"
        style={{
          transform: `translateX(-${offsetX}px)`,
          transition: touching ? 'none' : 'transform 0.2s ease',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (offsetX > 0) setOffsetX(0) }}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`w-11 h-11 rounded-xl ${ts.bg} flex items-center justify-center flex-shrink-0`}>
            <span className="text-xl">
              {tx.category?.icon ?? (tx.type === 'receita' ? '💰' : '💸')}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{tx.description}</p>

            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs text-gray-400">
                {format(new Date(tx.date + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}
              </span>
              {tx.category && (
                <span className="text-xs text-gray-400">· {tx.category.name}</span>
              )}
              {tx.bank && (
                <span className="text-xs text-gray-400">
                  · {tx.bank.icon} {tx.bank.name}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {tx.profile && (
                <div className="flex items-center gap-1">
                  <div
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ backgroundColor: tx.profile.avatar_color || '#6366F1' }}
                  >
                    {tx.profile.avatar_emoji || tx.profile.name?.[0]}
                  </div>
                  <span className="text-xs text-gray-400">
                    {tx.profile.name?.split(' ')[0]}
                  </span>
                </div>
              )}
              <span className={STATUS_BADGE[tx.status]}>
                {STATUS_LABEL[tx.status]}
              </span>
              {tx.is_recurring && <span className="text-xs">🔄</span>}
            </div>
          </div>

          {/* Amount */}
          <p className={`text-sm font-bold flex-shrink-0 ${ts.color}`}>
            {ts.sign}R${' '}
            {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-card border border-gray-100/50 p-4 mb-2 flex items-center gap-3">
      <div className="skeleton w-11 h-11 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 rounded w-40" />
        <div className="skeleton h-3 rounded w-28" />
      </div>
      <div className="skeleton h-4 rounded w-20" />
    </div>
  )
}

// ─── Summary chip ─────────────────────────────────────────────────────────────

function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex-1 bg-white rounded-2xl shadow-card border border-gray-100/50 px-3 py-2.5 text-center">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${color}`}>
        R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showFilters, setShowFilters] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<TransactionType | ''>('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterBankId, setFilterBankId] = useState('')
  const [filterProfileId, setFilterProfileId] = useState('')

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase
      .from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    if (!prof?.household_id) { setLoading(false); return }

    const hid = prof.household_id
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd')

    const [txRes, cRes, bRes, pRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(*), bank:banks(*), profile:profiles(id,name,avatar_color,avatar_emoji)')
        .eq('household_id', hid)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('household_id', hid).order('name'),
      supabase.from('banks').select('*').eq('household_id', hid).order('name'),
      supabase.from('profiles').select('*').eq('household_id', hid),
    ])

    setTransactions(txRes.data || [])
    setCategories(cRes.data || [])
    setBanks(bRes.data || [])
    setProfiles(pRes.data || [])
    setLoading(false)
  }, [currentDate])

  useEffect(() => {
    setLoading(true)
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const channel = supabase
      .channel('transactions-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  // Check URL param ?add=true (from mobile header)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('add') === 'true') setShowModal(true)
  }, [])

  const handleDelete = async (tx: Transaction) => {
    const { error } = await supabase.from('transactions').delete().eq('id', tx.id)
    if (error) {
      toast.error('Erro ao apagar')
    } else {
      toast.success('Lançamento apagado')
      setTransactions(prev => prev.filter(t => t.id !== tx.id))
    }
  }

  // Client-side filtering
  const filtered = transactions.filter(tx => {
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType && tx.type !== filterType) return false
    if (filterCategoryId && tx.category_id !== filterCategoryId) return false
    if (filterBankId && tx.bank_id !== filterBankId) return false
    if (filterProfileId && tx.created_by !== filterProfileId) return false
    return true
  })

  const income = transactions
    .filter(t => t.type === 'receita' && t.status === 'realizado')
    .reduce((s, t) => s + Number(t.amount), 0)
  const expenses = transactions
    .filter(t => t.type !== 'receita' && t.status === 'realizado')
    .reduce((s, t) => s + Number(t.amount), 0)
  const balance = income - expenses

  const activeFilterCount = [filterType, filterCategoryId, filterBankId, filterProfileId].filter(Boolean).length

  const clearFilters = () => {
    setFilterType('')
    setFilterCategoryId('')
    setFilterBankId('')
    setFilterProfileId('')
  }

  return (
    <AppLayout profile={profile}>
      <div className="pb-28 md:pb-8 space-y-4">

        {/* Page title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Lançamentos</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </p>
          </div>
        </div>

        <MonthSelector value={currentDate} onChange={d => { setCurrentDate(d); setLoading(true) }} />

        {/* Summary */}
        <div className="flex gap-2">
          <SummaryChip label="Receitas" value={income} color="text-emerald-600" />
          <SummaryChip label="Despesas" value={expenses} color="text-red-500" />
          <SummaryChip label="Saldo" value={balance} color={balance >= 0 ? 'text-emerald-600' : 'text-red-500'} />
        </div>

        {/* Search + Filter toggle */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar lançamento..."
              className="input pl-9"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5 text-gray-400" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-all duration-150
              ${showFilters || activeFilterCount > 0
                ? 'bg-primary-50 border-primary-300 text-primary-700'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="card space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">Filtros</p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-primary-600 font-medium hover:underline"
                >
                  Limpar tudo
                </button>
              )}
            </div>

            {/* Tipo */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Tipo</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: '', label: 'Todos' },
                  { value: 'receita', label: '💰 Receita' },
                  { value: 'despesa', label: '💸 Despesa' },
                  { value: 'fatura', label: '💳 Fatura' },
                  { value: 'transferencia', label: '🔄 Transfer.' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterType(opt.value as TransactionType | '')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150
                      ${filterType === opt.value
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Categoria */}
            <div>
              <p className="text-xs text-gray-500 font-medium mb-2">Categoria</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterCategoryId('')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150
                    ${!filterCategoryId
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Todas
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategoryId(cat.id === filterCategoryId ? '' : cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150
                      ${filterCategoryId === cat.id
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {cat.icon} {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Banco */}
            {banks.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">Banco / Cartão</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterBankId('')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150
                      ${!filterBankId
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    Todos
                  </button>
                  {banks.map(bank => (
                    <button
                      key={bank.id}
                      onClick={() => setFilterBankId(bank.id === filterBankId ? '' : bank.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150
                        ${filterBankId === bank.id
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {bank.icon} {bank.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quem lançou */}
            {profiles.length > 1 && (
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">Quem lançou</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilterProfileId('')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150
                      ${!filterProfileId
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    Todos
                  </button>
                  {profiles.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setFilterProfileId(p.id === filterProfileId ? '' : p.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150
                        ${filterProfileId === p.id
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      <div
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                        style={{ backgroundColor: p.avatar_color || '#6366F1' }}
                      >
                        {p.avatar_emoji || p.name[0]}
                      </div>
                      {p.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Result count */}
        {!loading && (
          <p className="text-xs text-gray-400 font-medium">
            {filtered.length === 0
              ? 'Nenhum lançamento encontrado'
              : `${filtered.length} lançamento${filtered.length !== 1 ? 's' : ''}`}
            {(activeFilterCount > 0 || search) && ' com filtros ativos'}
          </p>
        )}

        {/* List */}
        <div>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <p className="text-4xl">📭</p>
              <p className="text-sm font-medium text-gray-500">
                {transactions.length === 0
                  ? 'Nenhum lançamento neste mês'
                  : 'Nenhum resultado para os filtros'}
              </p>
              {transactions.length === 0 && (
                <button
                  onClick={() => setShowModal(true)}
                  className="btn-primary text-sm mt-2"
                >
                  Fazer primeiro lançamento
                </button>
              )}
            </div>
          ) : (
            filtered.map(tx => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                onDelete={() => handleDelete(tx)}
              />
            ))
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-24 md:bottom-8 right-5 md:right-8 w-14 h-14 bg-gradient-card rounded-2xl shadow-float flex items-center justify-center transition-transform duration-150 active:scale-95 z-30"
        aria-label="Adicionar lançamento"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Modal */}
      <AddTransactionModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={fetchData}
      />
    </AppLayout>
  )
}
