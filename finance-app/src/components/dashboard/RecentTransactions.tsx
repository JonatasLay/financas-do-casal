'use client'

import Link from 'next/link'
import { Transaction } from '@/types'
import { ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface RecentTransactionsProps {
  transactions: Transaction[]
  loading: boolean
  onRefresh: () => void
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function RecentTransactions({ transactions, loading, onRefresh }: RecentTransactionsProps) {
  if (loading) {
    return (
      <div className="card">
        <div className="skeleton h-5 w-40 mb-4 rounded" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="skeleton h-12 rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold" style={{ color: '#F1F5F9' }}>Últimos lançamentos</h2>
        <Link href="/transactions" className="text-xs font-medium flex items-center gap-1 transition-all hover:gap-2" style={{ color: '#818CF8' }}>
          Ver todos <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm mb-3" style={{ color: '#475569' }}>Nenhum lançamento ainda</p>
          <Link href="/transactions" className="btn-primary text-sm inline-flex items-center gap-1">
            + Adicionar primeiro
          </Link>
        </div>
      ) : (
        <div className="space-y-0.5">
          {transactions.map(tx => (
            <div
              key={tx.id}
              className="flex items-center gap-3 py-2.5 px-2 rounded-xl transition-colors cursor-pointer"
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(129,140,248,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Ícone categoria */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: (tx.category?.color || '#6366F1') + '25' }}
              >
                {tx.category?.icon || '📦'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#F1F5F9' }}>{tx.description}</p>
                <p className="text-xs flex items-center gap-1" style={{ color: '#475569' }}>
                  <span>{tx.category?.name || 'Sem categoria'}</span>
                  <span>·</span>
                  <span>{format(new Date(tx.date + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}</span>
                  {tx.profile && (
                    <>
                      <span>·</span>
                      <span
                        className="px-1 py-0.5 rounded text-white"
                        style={{ backgroundColor: (tx.profile as any).avatar_color || '#6366F1', fontSize: '10px' }}
                      >
                        {(tx.profile as any).name?.split(' ')[0]}
                      </span>
                    </>
                  )}
                  {tx.responsible_party === 'sogra' && (
                    <>
                      <span> - </span>
                      <span style={{ color: tx.is_reimbursed ? '#34D399' : '#FB923C' }}>
                        {tx.is_reimbursed ? 'Neusa ok' : 'Neusa a receber'}
                      </span>
                    </>
                  )}
                </p>
              </div>

              {/* Status + valor */}
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-semibold font-mono-nums`} style={{ color: tx.type === 'receita' ? '#34D399' : '#F87171' }}>
                  {tx.type === 'receita' ? '+' : '-'}{fmt(Number(tx.amount))}
                </p>
                {tx.status !== 'realizado' && (
                  <span className={`badge ${tx.status === 'pendente' ? 'badge-pending' : 'badge-done'}`}>
                    {tx.status}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
