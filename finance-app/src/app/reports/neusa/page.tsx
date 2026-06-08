'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, Printer, ReceiptText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { BankLogo } from '@/components/ui/BankLogo'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'
import {
  getNeusaShareAmount,
  hasNeusaShare,
  isCoupleTransaction,
  isNeusaReimbursement,
  isNeusaTransaction,
} from '@/lib/finance-summary'
import type { Bank, Transaction } from '@/types'

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function SectionRow({
  tx,
  amount,
  tone,
  detail,
}: {
  tx: Transaction
  amount: number
  tone: { bg: string; border: string; color: string }
  detail: string
}) {
  return (
    <div
      className="print-row rounded-xl px-3 py-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2"
      style={{ background: tone.bg, border: `1px solid ${tone.border}` }}
    >
      <div className="min-w-0">
        <p className="font-semibold" style={{ color: '#F1F5F9' }}>{tx.description}</p>
        <p className="print-muted text-xs mt-1 flex flex-wrap items-center gap-1.5" style={{ color: '#94A3B8' }}>
          <span>{format(new Date(`${tx.date}T12:00:00`), 'dd/MM/yyyy')}</span>
          {tx.category?.name && <span>| {tx.category.name}</span>}
          {tx.bank && (
            <span className="inline-flex items-center gap-1">
              | <BankLogo bank={tx.bank} size="xs" /> {tx.bank.name}
            </span>
          )}
          <span>| {detail}</span>
        </p>
      </div>
      <p className="font-bold md:text-right" style={{ color: tone.color }}>{brl(amount)}</p>
    </div>
  )
}

export default function NeusaReportPage() {
  const supabase = useMemo(() => createClient(), [])
  const params = useSearchParams()
  const now = new Date()
  const month = Number(params.get('month')) || now.getMonth() + 1
  const year = Number(params.get('year')) || now.getFullYear()
  const selectedDate = useMemo(() => new Date(year, month - 1, 1), [month, year])

  const [profile, setProfile] = useState<any>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [creditTransactions, setCreditTransactions] = useState<Transaction[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(prof)
      if (!prof?.household_id) {
        setLoading(false)
        return
      }

      const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd')
      const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd')
      const creditStart = format(startOfMonth(subMonths(selectedDate, 2)), 'yyyy-MM-dd')
      const creditEnd = format(endOfMonth(addMonths(selectedDate, 1)), 'yyyy-MM-dd')

      const [txRes, creditRes, banksRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, category:categories(*), bank:banks(*), profile:profiles(name)')
          .eq('household_id', prof.household_id)
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: true }),
        supabase
          .from('transactions')
          .select('*, category:categories(*), bank:banks(*), profile:profiles(name)')
          .eq('household_id', prof.household_id)
          .eq('status', 'realizado')
          .gte('date', creditStart)
          .lte('date', creditEnd)
          .order('date', { ascending: true }),
        supabase.from('banks').select('*').eq('household_id', prof.household_id),
      ])

      setTransactions((txRes.data || []) as Transaction[])
      setCreditTransactions((creditRes.data || []) as Transaction[])
      setBanks((banksRes.data || []) as Bank[])
      setLoading(false)
    }

    load()
  }, [selectedDate])

  const bankById = new Map(banks.map(bank => [bank.id, bank]))
  const isCreditTx = (tx: Transaction) => bankById.get(tx.bank_id || '')?.type === 'credito'

  const monthCashRows = transactions.filter(tx => !isCreditTx(tx))
  const reimbursementRows = monthCashRows.filter(tx => tx.type === 'receita' && isNeusaReimbursement(tx))
  const directExpenseRows = monthCashRows.filter(tx => tx.type !== 'receita')

  const directNeusaPaidByCouple = directExpenseRows
    .filter(tx => isNeusaTransaction(tx) && tx.affects_household_cash !== false)
    .sort((left, right) => left.date.localeCompare(right.date))
  const directNeusaControl = directExpenseRows
    .filter(tx => isNeusaTransaction(tx) && tx.affects_household_cash === false)
    .sort((left, right) => left.date.localeCompare(right.date))
  const sharedDirectRows = directExpenseRows
    .filter(tx => isCoupleTransaction(tx) && hasNeusaShare(tx))
    .sort((left, right) => left.date.localeCompare(right.date))

  const creditDueRows = creditTransactions.filter(tx => {
    const bank = bankById.get(tx.bank_id || '')
    if (!bank || bank.type !== 'credito' || tx.type === 'receita') return false
    return isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), selectedDate)
  })

  const directCardRows = creditDueRows
    .filter(isNeusaTransaction)
    .sort((left, right) => left.date.localeCompare(right.date))
  const sharedCardRows = creditDueRows
    .filter(tx => isCoupleTransaction(tx) && hasNeusaShare(tx))
    .sort((left, right) => left.date.localeCompare(right.date))

  const directCardTotal = directCardRows.reduce((sum, tx) => sum + Number(tx.amount), 0)
  const sharedCardTotal = sharedCardRows.reduce((sum, tx) => sum + getNeusaShareAmount(tx), 0)
  const sharedDirectTotal = sharedDirectRows.reduce((sum, tx) => sum + getNeusaShareAmount(tx), 0)
  const sharedTotal = sharedCardTotal + sharedDirectTotal
  const paidByCoupleTotal = directNeusaPaidByCouple.reduce((sum, tx) => sum + Number(tx.amount), 0)
  const controlTotal = directNeusaControl.reduce((sum, tx) => sum + Number(tx.amount), 0)
  const reimbursementTotal = reimbursementRows.reduce((sum, tx) => sum + Number(tx.amount), 0)

  const pendingDirectCard = directCardRows.filter(tx => !tx.is_reimbursed).reduce((sum, tx) => sum + Number(tx.amount), 0)
  const pendingPaidByCouple = directNeusaPaidByCouple.filter(tx => !tx.is_reimbursed).reduce((sum, tx) => sum + Number(tx.amount), 0)
  const receivableGross = pendingDirectCard + pendingPaidByCouple + sharedTotal
  const receivableNet = Math.max(0, receivableGross - reimbursementTotal)

  const title = `Relatorio da Neuza - ${format(selectedDate, 'MMMM yyyy', { locale: ptBR })}`

  const sections = [
    {
      key: 'card-direct',
      title: 'Uso direto do cartao de voces',
      subtitle: `Pendente: ${brl(pendingDirectCard)}`,
      rows: directCardRows,
      amountResolver: (tx: Transaction) => Number(tx.amount),
      detailResolver: (tx: Transaction) => {
        const bank = tx.bank
        const invoice = bank ? format(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), 'MM/yyyy') : 'sem fatura'
        return `fatura ${invoice} | ${tx.is_reimbursed ? 'reembolsado' : 'pendente'}`
      },
      tone: { bg: 'rgba(251,146,60,0.06)', border: 'rgba(251,146,60,0.14)', color: '#FB923C' },
    },
    {
      key: 'card-shared',
      title: 'Coparticipacao dela no cartao',
      subtitle: `Parcela dela na fatura: ${brl(sharedCardTotal)}`,
      rows: sharedCardRows,
      amountResolver: getNeusaShareAmount,
      detailResolver: (tx: Transaction) => {
        const bank = tx.bank
        const invoice = bank ? format(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), 'MM/yyyy') : 'sem fatura'
        return `bruto ${brl(Number(tx.amount))} | parcela dela ${brl(getNeusaShareAmount(tx))} | fatura ${invoice}`
      },
      tone: { bg: 'rgba(244,114,182,0.06)', border: 'rgba(244,114,182,0.14)', color: '#F9A8D4' },
    },
    {
      key: 'cash-direct',
      title: 'Contas dela pagas por voces',
      subtitle: `Ainda pendente: ${brl(pendingPaidByCouple)}`,
      rows: directNeusaPaidByCouple,
      amountResolver: (tx: Transaction) => Number(tx.amount),
      detailResolver: (tx: Transaction) => tx.is_reimbursed ? 'reembolsado' : 'pendente de reembolso',
      tone: { bg: 'rgba(34,211,238,0.06)', border: 'rgba(34,211,238,0.14)', color: '#22D3EE' },
    },
    {
      key: 'cash-shared',
      title: 'Coparticipacao dela em contas do casal',
      subtitle: `Parcela dela fora do cartao: ${brl(sharedDirectTotal)}`,
      rows: sharedDirectRows,
      amountResolver: getNeusaShareAmount,
      detailResolver: (tx: Transaction) => `bruto ${brl(Number(tx.amount))} | parcela dela ${brl(getNeusaShareAmount(tx))}`,
      tone: { bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.14)', color: '#C4B5FD' },
    },
    {
      key: 'control',
      title: 'Despesas dela so para controle',
      subtitle: `Nao entram no caixa do casal: ${brl(controlTotal)}`,
      rows: directNeusaControl,
      amountResolver: (tx: Transaction) => Number(tx.amount),
      detailResolver: () => 'somente controle',
      tone: { bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.14)', color: '#94A3B8' },
    },
    {
      key: 'reimbursements',
      title: 'Reembolsos recebidos da Neuza',
      subtitle: `Recebido no mes: ${brl(reimbursementTotal)}`,
      rows: reimbursementRows,
      amountResolver: (tx: Transaction) => Number(tx.amount),
      detailResolver: () => 'entrada de reembolso',
      tone: { bg: 'rgba(52,211,153,0.06)', border: 'rgba(52,211,153,0.14)', color: '#34D399' },
    },
  ].filter(section => section.rows.length > 0)

  return (
    <main className="min-h-screen p-4 md:p-8 print:p-0" style={{ background: '#08080F' }}>
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-page { background: white !important; color: #0f172a !important; border: none !important; box-shadow: none !important; }
          .print-muted { color: #475569 !important; }
          .print-row { border-color: #e2e8f0 !important; background: white !important; }
        }
      `}</style>

      <div className="no-print max-w-5xl mx-auto mb-4 flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium" style={{ color: '#A5B4FC' }}>
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
        <button onClick={() => window.print()} className="btn-primary inline-flex items-center gap-2">
          <Printer className="w-4 h-4" />
          Imprimir / Salvar PDF
        </button>
      </div>

      <section
        className="print-page max-w-5xl mx-auto rounded-3xl p-5 md:p-8"
        style={{ background: 'rgba(17,17,36,0.86)', border: '1px solid rgba(129,140,248,0.18)' }}
      >
        <header className="flex items-start justify-between gap-4 pb-5" style={{ borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
          <div>
            <div className="flex items-center gap-2">
              <ReceiptText className="w-5 h-5" style={{ color: '#F9A8D4' }} />
              <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>{title}</h1>
            </div>
            <p className="print-muted text-sm mt-1" style={{ color: '#94A3B8' }}>
              Separacao completa entre o que e uso dela no cartao, o que voces pagaram do bolso, o que e so controle e o que ja foi devolvido ao casal.
            </p>
          </div>
          <div className="text-right">
            <p className="print-muted text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Emitido por</p>
            <p className="font-semibold" style={{ color: '#F1F5F9' }}>{profile?.name || 'Financas do Casal'}</p>
            <p className="print-muted text-xs" style={{ color: '#64748B' }}>{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-5">
          {[
            { label: 'A receber da Neuza', value: receivableNet, color: '#FBBF24' },
            { label: 'Reembolsos recebidos', value: reimbursementTotal, color: '#34D399' },
            { label: 'Uso direto no cartao', value: directCardTotal, color: '#FB923C' },
            { label: 'Coparticipacoes dela', value: sharedTotal, color: '#F9A8D4' },
            { label: 'Pagas por voces', value: paidByCoupleTotal, color: '#22D3EE' },
            { label: 'So controle dela', value: controlTotal, color: '#94A3B8' },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-2xl p-4 print-row"
              style={{ background: `${item.color}12`, border: `1px solid ${item.color}33` }}
            >
              <p className="print-muted text-xs uppercase tracking-wide" style={{ color: '#94A3B8' }}>{item.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: item.color }}>{brl(item.value)}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="print-muted text-sm py-8" style={{ color: '#94A3B8' }}>Carregando relatorio...</p>
        ) : sections.length === 0 ? (
          <p className="print-muted text-sm py-8" style={{ color: '#94A3B8' }}>Nenhum movimento da Neuza neste mes.</p>
        ) : (
          <div className="space-y-6">
            {sections.map(section => (
              <section key={section.key} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold" style={{ color: '#F1F5F9' }}>{section.title}</h2>
                  <span className="print-muted text-xs" style={{ color: '#94A3B8' }}>{section.subtitle}</span>
                </div>
                {section.rows.map(tx => (
                  <SectionRow
                    key={tx.id}
                    tx={tx}
                    amount={section.amountResolver(tx)}
                    tone={section.tone}
                    detail={section.detailResolver(tx)}
                  />
                ))}
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
