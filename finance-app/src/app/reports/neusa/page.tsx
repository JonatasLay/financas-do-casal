'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BankLogo } from '@/components/ui/BankLogo'
import { ArrowLeft, Printer, ReceiptText } from 'lucide-react'
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'
import type { Bank, Transaction } from '@/types'

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function NeusaReportPage() {
  const supabase = createClient()
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
      if (!prof?.household_id) { setLoading(false); return }

      const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd')
      const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd')
      const creditStart = format(startOfMonth(subMonths(selectedDate, 2)), 'yyyy-MM-dd')
      const creditEnd = format(endOfMonth(addMonths(selectedDate, 1)), 'yyyy-MM-dd')

      const [txRes, creditRes, banksRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*, category:categories(*), bank:banks(*), profile:profiles(name)')
          .eq('household_id', prof.household_id)
          .eq('responsible_party', 'sogra')
          .gte('date', start)
          .lte('date', end)
          .order('date', { ascending: true }),
        supabase
          .from('transactions')
          .select('*, category:categories(*), bank:banks(*), profile:profiles(name)')
          .eq('household_id', prof.household_id)
          .eq('responsible_party', 'sogra')
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
  const cashTxs = transactions.filter(tx => !isCreditTx(tx))
  const creditTxs = creditTransactions.filter(tx => {
    const bank = bankById.get(tx.bank_id || '')
    if (!bank || bank.type !== 'credito' || tx.type === 'receita') return false
    return isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), selectedDate)
  })
  const reportTxs = [...cashTxs, ...creditTxs].filter(tx => tx.type !== 'receita')
    .sort((a, b) => a.date.localeCompare(b.date))
  const total = reportTxs.reduce((sum, tx) => sum + Number(tx.amount), 0)
  const pending = reportTxs.filter(tx => !tx.is_reimbursed).reduce((sum, tx) => sum + Number(tx.amount), 0)
  const reimbursed = total - pending
  const title = `Relatório Neusa - ${format(selectedDate, 'MMMM yyyy', { locale: ptBR })}`

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

      <section className="print-page max-w-5xl mx-auto rounded-3xl p-5 md:p-8"
        style={{ background: 'rgba(17,17,36,0.86)', border: '1px solid rgba(129,140,248,0.18)' }}>
        <header className="flex items-start justify-between gap-4 pb-5" style={{ borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
          <div>
            <div className="flex items-center gap-2">
              <ReceiptText className="w-5 h-5" style={{ color: '#F9A8D4' }} />
              <h1 className="text-xl md:text-2xl font-bold" style={{ color: '#F1F5F9' }}>{title}</h1>
            </div>
            <p className="print-muted text-sm mt-1" style={{ color: '#94A3B8' }}>
              Gastos lançados como responsabilidade da Neusa no mês selecionado.
            </p>
          </div>
          <div className="text-right">
            <p className="print-muted text-xs uppercase tracking-wide" style={{ color: '#64748B' }}>Emitido por</p>
            <p className="font-semibold" style={{ color: '#F1F5F9' }}>{profile?.name || 'Finanças do Casal'}</p>
            <p className="print-muted text-xs" style={{ color: '#64748B' }}>{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-5">
          {[
            { label: 'Total do mês', value: total, color: '#F9A8D4' },
            { label: 'Pendente de reembolso', value: pending, color: '#FBBF24' },
            { label: 'Já reembolsado', value: reimbursed, color: '#34D399' },
          ].map(item => (
            <div key={item.label} className="rounded-2xl p-4 print-row"
              style={{ background: `${item.color}12`, border: `1px solid ${item.color}33` }}>
              <p className="print-muted text-xs uppercase tracking-wide" style={{ color: '#94A3B8' }}>{item.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: item.color }}>{brl(item.value)}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="print-muted text-sm py-8" style={{ color: '#94A3B8' }}>Carregando relatório...</p>
        ) : reportTxs.length === 0 ? (
          <p className="print-muted text-sm py-8" style={{ color: '#94A3B8' }}>Nenhum gasto da Neusa neste mês.</p>
        ) : (
          <div className="space-y-2">
            {reportTxs.map(tx => (
              <div key={tx.id} className="print-row rounded-xl px-3 py-3 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="min-w-0">
                  <p className="font-semibold" style={{ color: '#F1F5F9' }}>{tx.description}</p>
                  <p className="print-muted text-xs mt-1 flex flex-wrap items-center gap-1.5" style={{ color: '#94A3B8' }}>
                    <span>{format(new Date(`${tx.date}T12:00:00`), 'dd/MM/yyyy')}</span>
                    {tx.category?.name && <span>· {tx.category.name}</span>}
                    {tx.bank && <span className="inline-flex items-center gap-1">· <BankLogo bank={tx.bank} size="xs" /> {tx.bank.name}</span>}
                    {isCreditTx(tx) && <span>· fatura {format(getCreditCardPaymentDate(tx.date, tx.bank?.due_day, tx.bank?.closing_day), 'MM/yyyy')}</span>}
                    <span>· {tx.is_reimbursed ? 'reembolsado' : 'pendente'}</span>
                  </p>
                </div>
                <p className="font-bold md:text-right" style={{ color: tx.is_reimbursed ? '#34D399' : '#FBBF24' }}>{brl(Number(tx.amount))}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
