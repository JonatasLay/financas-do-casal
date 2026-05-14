'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppLayout } from '@/components/layout/AppLayout'
import { MonthSelector } from '@/components/ui/MonthSelector'
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal'
import { StatementImportModal } from '@/components/transactions/StatementImportModal'
import { BankLogo } from '@/components/ui/BankLogo'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, CheckCircle2, FileUp, HandCoins, Plus, Search, Trash2, Pencil, X, SlidersHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { getCreditCardPaymentDate } from '@/lib/finance-dates'
import type { Transaction, Category, Bank, TransactionType, Profile, ResponsibleParty, PaymentMethod } from '@/types'

// ─── Transaction row with swipe + edit/delete ────────────────────────────────

const TYPE_COLOR: Record<TransactionType, string> = {
  receita:       '#34D399',
  despesa:       '#F87171',
  fatura:        '#FB923C',
  transferencia: '#22D3EE',
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

const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  credito: 'Credito',
  debito: 'Debito',
  boleto: 'Boleto',
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  transferencia: 'Transfer.',
  outro: 'Outro',
}

const brl = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

function getInstallmentLabel(tx: Transaction) {
  const match = `${tx.description} ${tx.notes || ''}`.match(/(Parcela|Boleto)\s+(\d{1,2})\/(\d{1,2})/i)
  if (!match) return null
  return `${match[1]} ${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}`
}

function TransactionRow({
  tx,
  onDelete,
  onEdit,
  onPay,
  onReimburse,
}: {
  tx: Transaction
  onDelete: () => void
  onEdit: () => void
  onPay: () => void
  onReimburse: () => void
}) {
  const [offsetX, setOffsetX] = useState(0)
  const [touching, setTouching] = useState(false)
  const startX = useRef(0)
  const startY = useRef(0)
  const direction = useRef<'h' | 'v' | null>(null)
  const MAX_SWIPE = 132
  const SNAP_THRESHOLD = 64

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
      if (Math.abs(dx) > 6 || dy > 6) direction.current = Math.abs(dx) >= dy ? 'h' : 'v'
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

  const color = TYPE_COLOR[tx.type] ?? '#F87171'
  const sign  = tx.type === 'receita' ? '+' : '-'
  const installmentLabel = getInstallmentLabel(tx)
  const isCredit = tx.bank?.type === 'credito'
  const invoiceDate = isCredit ? getCreditCardPaymentDate(tx.date, tx.bank?.due_day, tx.bank?.closing_day) : null
  const paid = tx.status === 'realizado'
  const statusLabel = paid && tx.type === 'receita' ? 'Recebido' : STATUS_LABEL[tx.status]
  const isNeusa = tx.responsible_party === 'sogra'
  const reimbursementPending = isNeusa && !tx.is_reimbursed

  return (
    <div className="relative overflow-hidden rounded-2xl mb-2">
      {/* Actions revealed on swipe */}
      <div className="absolute inset-y-0 right-0 flex md:hidden" style={{ width: MAX_SWIPE }}>
        <button onClick={onEdit}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-white transition-opacity"
          style={{ background: '#818CF8' }}>
          <Pencil className="w-4 h-4" />
          <span className="text-xs font-medium">Editar</span>
        </button>
        <button onClick={onDelete}
          className="flex-1 flex flex-col items-center justify-center gap-1 text-white transition-opacity"
          style={{ background: '#F87171' }}>
          <Trash2 className="w-4 h-4" />
          <span className="text-xs font-medium">Apagar</span>
        </button>
      </div>

      {/* Main card */}
      <div
        className="relative rounded-2xl p-4 z-10"
        style={{
          background: 'rgba(17,17,36,0.72)',
          border: '1px solid rgba(129,140,248,0.12)',
          borderLeft: `3px solid ${color}`,
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
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: color + '20' }}>
            <span className="text-xl">
              {tx.category?.icon ?? (tx.type === 'receita' ? '💰' : '💸')}
            </span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>{tx.description}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs" style={{ color: '#475569' }}>
                {format(new Date(tx.date + 'T12:00:00'), "dd 'de' MMM", { locale: ptBR })}
              </span>
              {tx.category && <span className="text-xs" style={{ color: '#475569' }}>· {tx.category.name}</span>}
              {tx.bank && (
                <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#475569' }}>
                  · <BankLogo bank={tx.bank} size="xs" /> {tx.bank.name}
                </span>
              )}
              {invoiceDate && (
                <span className="text-xs" style={{ color: '#FB923C' }}>
                  · Fatura {format(invoiceDate, 'MMM/yy', { locale: ptBR })}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {tx.profile && (
                <div className="flex items-center gap-1">
                  <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                    style={{ backgroundColor: tx.profile.avatar_color || '#6366F1' }}>
                    {tx.profile.avatar_emoji || tx.profile.name?.[0]}
                  </div>
                  <span className="text-xs" style={{ color: '#475569' }}>{tx.profile.name?.split(' ')[0]}</span>
                </div>
              )}
              <span className={STATUS_BADGE[tx.status]}>{statusLabel}</span>
              {tx.payment_method && tx.payment_method !== 'outro' && (
                <span className="badge" style={{
                  background: tx.payment_method === 'boleto' ? 'rgba(251,191,36,0.12)' : 'rgba(129,140,248,0.1)',
                  border: tx.payment_method === 'boleto' ? '1px solid rgba(251,191,36,0.24)' : '1px solid rgba(129,140,248,0.18)',
                  color: tx.payment_method === 'boleto' ? '#FBBF24' : '#A5B4FC',
                }}>
                  {PAYMENT_METHOD_LABEL[tx.payment_method]}
                </span>
              )}
              {installmentLabel && (
                <span className="badge" style={{ background: 'rgba(251,146,60,0.12)', border: '1px solid rgba(251,146,60,0.25)', color: '#FB923C' }}>
                  {installmentLabel}
                </span>
              )}
              {isNeusa && (
                <span className="badge" style={{
                  background: reimbursementPending ? 'rgba(251,146,60,0.12)' : 'rgba(52,211,153,0.1)',
                  border: reimbursementPending ? '1px solid rgba(251,146,60,0.24)' : '1px solid rgba(52,211,153,0.2)',
                  color: reimbursementPending ? '#FB923C' : '#34D399',
                }}>
                  {reimbursementPending ? 'Neusa a reembolsar' : 'Neusa reembolsou'}
                </span>
              )}
              {!paid && (
                <button onClick={onPay}
                  className="md:hidden badge inline-flex items-center gap-1"
                  style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.22)', color: '#34D399' }}>
                  <CheckCircle2 className="w-3 h-3" />
                  {tx.type === 'receita' ? 'Receber' : 'Pagar'}
                </button>
              )}
              {reimbursementPending && (
                <button onClick={onReimburse}
                  className="md:hidden badge inline-flex items-center gap-1"
                  style={{ background: 'rgba(244,114,182,0.1)', border: '1px solid rgba(244,114,182,0.22)', color: '#F9A8D4' }}>
                  <HandCoins className="w-3 h-3" />
                  Reembolsou
                </button>
              )}
              {tx.is_recurring && <span className="text-xs">🔄</span>}
            </div>
          </div>

          {/* Amount + desktop actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden md:flex items-center gap-1">
              {!paid && (
                <button onClick={onPay}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
                  style={{ color: '#34D399', background: 'rgba(52,211,153,0.09)', border: '1px solid rgba(52,211,153,0.2)' }}
                  title={tx.type === 'receita' ? 'Marcar como recebido' : 'Marcar como pago'}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {tx.type === 'receita' ? 'Receber' : 'Pagar'}
                </button>
              )}
              {reimbursementPending && (
                <button onClick={onReimburse}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors inline-flex items-center gap-1"
                  style={{ color: '#F9A8D4', background: 'rgba(244,114,182,0.09)', border: '1px solid rgba(244,114,182,0.2)' }}
                  title="Marcar reembolso da Neusa">
                  <HandCoins className="w-3.5 h-3.5" />
                  Reembolsou
                </button>
              )}
              <button onClick={onEdit}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#818CF8' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title="Editar">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: '#F87171' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.12)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                title="Apagar">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="rounded-xl px-3 py-1.5 text-sm font-bold font-mono-nums"
              style={{ color, background: color + '12', border: `1px solid ${color}24` }}>
              {sign}{brl(Number(tx.amount))}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="rounded-2xl p-4 mb-2 flex items-center gap-3"
      style={{ background: 'rgba(17,17,36,0.8)', border: '1px solid rgba(129,140,248,0.08)' }}>
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
    <div className="rounded-2xl px-4 py-3 min-h-[74px] flex flex-col justify-between"
      style={{ background: `linear-gradient(135deg, ${color}14, rgba(17,17,36,0.88))`, border: `1px solid ${color}33` }}>
      <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>{label}</p>
      <p className="text-base font-bold mt-1 font-mono-nums" style={{ color }}>
        {brl(value)}
      </p>
    </div>
  )
}

// ─── Filter button ─────────────────────────────────────────────────────────────

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-150"
      style={active
        ? { background: 'rgba(129,140,248,0.18)', borderColor: '#818CF8', color: '#818CF8' }
        : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)', color: '#64748B' }}>
      {children}
    </button>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

function TransactionDayGroup({
  date,
  total,
  children,
}: {
  date: string
  total: number
  children: React.ReactNode
}) {
  const dateObj = new Date(`${date}T12:00:00`)
  const isPositive = total >= 0

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(129,140,248,0.12)', color: '#A5B4FC' }}>
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold capitalize" style={{ color: '#E2E8F0' }}>
              {format(dateObj, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-[11px]" style={{ color: '#475569' }}>
              {format(dateObj, 'yyyy', { locale: ptBR })}
            </p>
          </div>
        </div>
        <div className="rounded-xl px-3 py-1.5 text-xs font-bold font-mono-nums"
          style={{
            background: isPositive ? 'rgba(52,211,153,0.10)' : 'rgba(248,113,113,0.10)',
            border: isPositive ? '1px solid rgba(52,211,153,0.20)' : '1px solid rgba(248,113,113,0.20)',
            color: isPositive ? '#34D399' : '#F87171',
          }}>
          {isPositive ? '+' : ''}{brl(total)}
        </div>
      </div>
      <div className="space-y-2">
        {children}
      </div>
    </section>
  )
}

export default function TransactionsPage() {
  const supabase = createClient()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [creditInvoiceTransactions, setCreditInvoiceTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingTx, setEditingTx] = useState<Transaction | null>(null)
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<TransactionType | ''>('')
  const [filterCategoryId, setFilterCategoryId] = useState('')
  const [filterBankId, setFilterBankId] = useState('')
  const [filterProfileId, setFilterProfileId] = useState('')
  const [filterResponsible, setFilterResponsible] = useState<ResponsibleParty | ''>('')

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(prof)
    if (!prof?.household_id) { setLoading(false); return }

    const hid   = prof.household_id
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd')
    const end   = format(endOfMonth(currentDate), 'yyyy-MM-dd')
    const creditStart = format(startOfMonth(subMonths(currentDate, 2)), 'yyyy-MM-dd')
    const creditEnd = format(endOfMonth(addMonths(currentDate, 1)), 'yyyy-MM-dd')

    const [txRes, creditTxRes, cRes, bRes, pRes] = await Promise.all([
      supabase
        .from('transactions')
        .select('*, category:categories(*), bank:banks(*), profile:profiles(id,name,avatar_color,avatar_emoji)')
        .eq('household_id', hid)
        .gte('date', start).lte('date', end)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('transactions')
        .select('*, category:categories(*), bank:banks(*), profile:profiles(id,name,avatar_color,avatar_emoji)')
        .eq('household_id', hid)
        .gte('date', creditStart).lte('date', creditEnd)
        .order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('household_id', hid).order('name'),
      supabase.from('banks').select('*').eq('household_id', hid).order('name'),
      supabase.from('profiles').select('*').eq('household_id', hid),
    ])

    setTransactions(txRes.data || [])
    setCreditInvoiceTransactions(creditTxRes.data || [])
    setCategories(cRes.data || [])
    setBanks(bRes.data || [])
    setProfiles(pRes.data || [])
    setLoading(false)
  }, [currentDate])

  useEffect(() => { setLoading(true); fetchData() }, [fetchData])

  useEffect(() => {
    const channel = supabase.channel('transactions-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('add') === 'true') setShowModal(true)
  }, [])

  const handleDelete = async () => {
    if (!deletingTx) return
    const query = deletingTx.recurring_group_id
      ? supabase.from('transactions').delete().eq('recurring_group_id', deletingTx.recurring_group_id).gte('date', deletingTx.date)
      : supabase.from('transactions').delete().eq('id', deletingTx.id)
    const { error } = await query
    if (error) toast.error('Erro ao apagar')
    else {
      toast.success(deletingTx.recurring_group_id ? 'Lançamento e recorrências futuras apagados' : 'Lançamento apagado')
      await fetchData()
    }
    setDeletingTx(null)
  }

  const handlePay = async (tx: Transaction) => {
    const { error } = await supabase.from('transactions').update({ status: 'realizado' }).eq('id', tx.id)
    if (error) return void toast.error('Erro ao atualizar status')
    toast.success(tx.type === 'receita' ? 'Recebimento realizado' : 'Pagamento realizado')
    setTransactions(prev => prev.map(item => item.id === tx.id ? { ...item, status: 'realizado' } : item))
  }

  const handleReimburse = async (tx: Transaction) => {
    const { error } = await supabase.from('transactions').update({ is_reimbursed: true }).eq('id', tx.id)
    if (error) return void toast.error('Erro ao marcar reembolso')
    toast.success('Reembolso da Neusa marcado')
    setTransactions(prev => prev.map(item => item.id === tx.id ? { ...item, is_reimbursed: true } : item))
  }

  const handleEdit = (tx: Transaction) => {
    setEditingTx(tx)
    setShowModal(true)
  }

  const handleModalClose = () => {
    setShowModal(false)
    setEditingTx(null)
  }

  const filtered = transactions.filter(tx => {
    if (search && !tx.description.toLowerCase().includes(search.toLowerCase())) return false
    if (filterType && tx.type !== filterType) return false
    if (filterCategoryId && tx.category_id !== filterCategoryId) return false
    if (filterBankId && tx.bank_id !== filterBankId) return false
    if (filterProfileId && tx.created_by !== filterProfileId) return false
    if (filterResponsible && (tx.responsible_party || 'casal') !== filterResponsible) return false
    return true
  })

  const groupedTransactions = filtered.reduce((groups, tx) => {
    const key = tx.date
    if (!groups[key]) groups[key] = []
    groups[key].push(tx)
    return groups
  }, {} as Record<string, Transaction[]>)

  const groupedEntries = Object.entries(groupedTransactions)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => ({
      date,
      items,
      total: items.reduce((sum, tx) => sum + (tx.type === 'receita' ? Number(tx.amount) : -Number(tx.amount)), 0),
    }))

  const bankById = new Map(banks.map(bank => [bank.id, bank]))
  const isCreditTx = (tx: Transaction) => bankById.get(tx.bank_id || '')?.type === 'credito'
  const creditInvoiceDueThisMonth = creditInvoiceTransactions.filter(tx => {
    const bank = bankById.get(tx.bank_id || '')
    if (!bank || bank.type !== 'credito' || tx.type === 'receita' || tx.status !== 'realizado') return false
    const invoiceDate = getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day)
    return invoiceDate >= startOfMonth(currentDate) && invoiceDate <= endOfMonth(currentDate)
  })
  const cashTransactions = transactions.filter(tx => !isCreditTx(tx))
  const monthFinancialTransactions = [...cashTransactions, ...creditInvoiceDueThisMonth]

  const income = transactions.filter(t => t.type === 'receita' && t.status === 'realizado').reduce((s, t) => s + Number(t.amount), 0)
  const plannedIncome = transactions.filter(t => t.type === 'receita' && t.status !== 'realizado').reduce((s, t) => s + Number(t.amount), 0)
  const coupleExpenses = monthFinancialTransactions
    .filter(t => t.type !== 'receita' && (t.responsible_party || 'casal') === 'casal')
    .reduce((s, t) => s + Number(t.amount), 0)
  const globalExpenses = coupleExpenses
  const neusaCardExpenses = creditInvoiceDueThisMonth
    .filter(t => t.type !== 'receita' && t.responsible_party === 'sogra')
    .reduce((s, t) => s + Number(t.amount), 0)
  const neusaDirectExpenses = cashTransactions
    .filter(t => t.type !== 'receita' && t.responsible_party === 'sogra')
    .reduce((s, t) => s + Number(t.amount), 0)
  const neusaExpenses = neusaCardExpenses + neusaDirectExpenses
  const neusaPending = creditInvoiceDueThisMonth
    .filter(t => t.type !== 'receita' && t.responsible_party === 'sogra' && !t.is_reimbursed)
    .reduce((s, t) => s + Number(t.amount), 0)
  const balance  = income + plannedIncome - coupleExpenses

  const activeFilterCount = [filterType, filterCategoryId, filterBankId, filterProfileId, filterResponsible].filter(Boolean).length

  const clearFilters = () => {
    setFilterType(''); setFilterCategoryId(''); setFilterBankId(''); setFilterProfileId(''); setFilterResponsible('')
  }

  return (
    <AppLayout profile={profile}>
      <div className="pb-28 md:pb-8 space-y-4">

        <section className="rounded-3xl p-4 md:p-5 space-y-4"
          style={{ background: 'rgba(13,13,26,0.72)', border: '1px solid rgba(129,140,248,0.16)', boxShadow: '0 18px 60px rgba(0,0,0,0.22)' }}>
        {/* Page title */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold" style={{ color: '#F1F5F9' }}>Lançamentos</h1>
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </p>
          </div>
          <button onClick={() => setShowImportModal(true)}
            className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.22)', color: '#22D3EE' }}>
            <FileUp className="w-4 h-4" />
            Importar extrato
          </button>
        </div>

        <MonthSelector value={currentDate} onChange={d => { setCurrentDate(d); setLoading(true) }} />

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <SummaryChip label="Receitas mês" value={income + plannedIncome} color="#34D399" />
          <SummaryChip label="Desp. casal" value={coupleExpenses} color="#818CF8" />
          <SummaryChip label="Neusa total" value={neusaExpenses} color="#F9A8D4" />
          <SummaryChip label="Total despesas" value={globalExpenses} color="#FB923C" />
          <SummaryChip label="Saldo previsto" value={balance} color={balance >= 0 ? '#34D399' : '#F87171'} />
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl p-1.5" style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {([
            { value: '' as const, label: 'Todos' },
            { value: 'casal' as const, label: 'Casal' },
            { value: 'sogra' as const, label: 'Neusa' },
          ]).map(item => {
            const active = filterResponsible === item.value
            return (
              <button key={item.label} type="button" onClick={() => setFilterResponsible(item.value)}
                className="rounded-xl px-3 py-2 text-sm font-semibold transition-all"
                style={active
                  ? { background: 'rgba(129,140,248,0.18)', color: '#C7D2FE', border: '1px solid rgba(129,140,248,0.35)' }
                  : { color: '#64748B', border: '1px solid transparent' }}>
                {item.label}
              </button>
            )
          })}
        </div>
        </section>

        {neusaPending > 0 && (
          <div className="rounded-2xl px-3 py-2 flex items-center justify-between gap-3"
            style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.16)' }}>
            <span className="text-xs font-medium" style={{ color: '#FBBF24' }}>Neusa no cartão a reembolsar neste mês</span>
            <span className="text-xs font-bold font-mono-nums" style={{ color: '#FBBF24' }}>
              R$ {neusaPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {/* Search + Filter toggle */}
        <div className="sticky top-20 z-20 flex gap-2 rounded-2xl p-2"
          style={{ background: 'rgba(8,8,15,0.82)', border: '1px solid rgba(129,140,248,0.10)', backdropFilter: 'blur(16px)' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#475569' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar lançamento..." className="input pl-9" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5" style={{ color: '#475569' }} />
              </button>
            )}
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className="relative flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={showFilters || activeFilterCount > 0
              ? { background: 'rgba(129,140,248,0.15)', border: '1px solid rgba(129,140,248,0.4)', color: '#818CF8' }
              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748B' }}>
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
                style={{ background: '#818CF8' }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <button onClick={() => setShowImportModal(true)}
            className="md:hidden flex items-center justify-center px-3.5 py-2.5 rounded-xl"
            style={{ background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.22)', color: '#22D3EE' }}
            aria-label="Importar extrato">
            <FileUp className="w-4 h-4" />
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="card animate-fade-in space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>Filtros</p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} className="text-xs font-medium" style={{ color: '#818CF8' }}>
                  Limpar tudo
                </button>
              )}
            </div>

            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>Tipo</p>
              <div className="flex flex-wrap gap-2">
                <FilterBtn active={filterType === ''} onClick={() => setFilterType('')}>Todos</FilterBtn>
                <FilterBtn active={filterType === 'receita'} onClick={() => setFilterType('receita')}>💰 Receita</FilterBtn>
                <FilterBtn active={filterType === 'despesa'} onClick={() => setFilterType('despesa')}>💸 Despesa</FilterBtn>
                <FilterBtn active={filterType === 'fatura'} onClick={() => setFilterType('fatura')}>💳 Fatura</FilterBtn>
                <FilterBtn active={filterType === 'transferencia'} onClick={() => setFilterType('transferencia')}>🔄 Transfer.</FilterBtn>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>Categoria</p>
              <div className="flex flex-wrap gap-2">
                <FilterBtn active={filterCategoryId === ''} onClick={() => setFilterCategoryId('')}>Todas</FilterBtn>
                {categories.map(cat => (
                  <FilterBtn key={cat.id} active={filterCategoryId === cat.id}
                    onClick={() => setFilterCategoryId(cat.id === filterCategoryId ? '' : cat.id)}>
                    {cat.icon} {cat.name}
                  </FilterBtn>
                ))}
              </div>
            </div>

            {banks.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>Banco / Cartão</p>
                <div className="flex flex-wrap gap-2">
                  <FilterBtn active={filterBankId === ''} onClick={() => setFilterBankId('')}>Todos</FilterBtn>
                  {banks.map(bank => (
                    <FilterBtn key={bank.id} active={filterBankId === bank.id}
                      onClick={() => setFilterBankId(bank.id === filterBankId ? '' : bank.id)}>
                    <span className="inline-flex items-center gap-1.5">
                      <BankLogo bank={bank} size="xs" /> {bank.name}
                    </span>
                  </FilterBtn>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>Responsavel</p>
              <div className="flex flex-wrap gap-2">
                <FilterBtn active={filterResponsible === ''} onClick={() => setFilterResponsible('')}>Todos</FilterBtn>
                <FilterBtn active={filterResponsible === 'casal'} onClick={() => setFilterResponsible('casal')}>Casal</FilterBtn>
                <FilterBtn active={filterResponsible === 'sogra'} onClick={() => setFilterResponsible('sogra')}>Neusa</FilterBtn>
              </div>
            </div>

            {profiles.length > 1 && (
              <div>
                <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>Quem lançou</p>
                <div className="flex flex-wrap gap-2">
                  <FilterBtn active={filterProfileId === ''} onClick={() => setFilterProfileId('')}>Todos</FilterBtn>
                  {profiles.map(p => (
                    <FilterBtn key={p.id} active={filterProfileId === p.id}
                      onClick={() => setFilterProfileId(p.id === filterProfileId ? '' : p.id)}>
                      {p.name.split(' ')[0]}
                    </FilterBtn>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Result count */}
        {!loading && (
          <p className="text-xs font-medium" style={{ color: '#334155' }}>
            {filtered.length === 0
              ? 'Nenhum lançamento encontrado'
              : `${filtered.length} lançamento${filtered.length !== 1 ? 's' : ''}`}
            {(activeFilterCount > 0 || search) && ' com filtros ativos'}
          </p>
        )}

        {/* List */}
        <div className="space-y-5">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <p className="text-4xl">📭</p>
              <p className="text-sm font-medium" style={{ color: '#475569' }}>
                {transactions.length === 0
                  ? 'Nenhum lançamento neste mês'
                  : 'Nenhum resultado para os filtros'}
              </p>
              {transactions.length === 0 && (
                <button onClick={() => setShowModal(true)} className="btn-primary text-sm mt-2">
                  Fazer primeiro lançamento
                </button>
              )}
            </div>
          ) : (
            groupedEntries.map(group => (
              <TransactionDayGroup key={group.date} date={group.date} total={group.total}>
                {group.items.map(tx => (
                  <TransactionRow key={tx.id} tx={tx}
                    onDelete={() => setDeletingTx(tx)}
                    onEdit={() => handleEdit(tx)}
                    onPay={() => handlePay(tx)}
                    onReimburse={() => handleReimburse(tx)}
                  />
                ))}
              </TransactionDayGroup>
            ))
          )}
        </div>
      </div>

      {/* FAB */}
      <button onClick={() => { setEditingTx(null); setShowModal(true) }}
        className="fixed bottom-24 md:bottom-8 right-5 md:right-8 w-14 h-14 bg-gradient-card rounded-2xl shadow-float flex items-center justify-center transition-transform duration-150 active:scale-95 z-30"
        aria-label="Adicionar lançamento">
        <Plus className="w-6 h-6 text-white" />
      </button>

      {/* Modal */}
      <AddTransactionModal
        open={showModal}
        onClose={handleModalClose}
        onSuccess={fetchData}
        editTransaction={editingTx}
      />

      <StatementImportModal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={fetchData}
        banks={banks}
        categories={categories}
        existingTransactions={transactions}
        householdId={profile?.household_id}
        profileId={profile?.id}
      />

      <ConfirmDialog
        open={!!deletingTx}
        title="Apagar lançamento?"
        message={deletingTx ? `"${deletingTx.description}" ${deletingTx.recurring_group_id ? 'e as recorrências futuras serão apagados.' : 'será apagado permanentemente.'}` : ''}
        confirmLabel="Apagar"
        onConfirm={handleDelete}
        onCancel={() => setDeletingTx(null)}
      />
    </AppLayout>
  )
}
