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
        <h2 className="font-semibold text-gray-900">Últimos lançamentos</h2>
        <Link href="/transactions" className="text-xs text-primary-600 font-medium flex items-center gap-1 hover:gap-2 transition-all">
          Ver todos <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-sm text-gray-500 mb-3">Nenhum lançamento ainda</p>
          <Link href="/transactions" className="btn-primary text-sm inline-flex items-center gap-1">
            + Adicionar primeiro
          </Link>
        </div>
      ) : (
        <div className="space-y-0.5">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center gap-3 py-2.5 px-2 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
              {/* Ícone categoria */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                style={{ backgroundColor: (tx.category?.color || '#6366F1') + '20' }}
              >
                {tx.category?.icon || '📦'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <span>{tx.category?.name || 'Sem categoria'}</span>
                  <span>·</span>
                  <span>{format(new Date(tx.date + 'T12:00:00'), "d 'de' MMM", { locale: ptBR })}</span>
                  {tx.profile && (
                    <>
                      <span>·</span>
                      <span
                        className="px-1 py-0.5 rounded text-white text-xs"
                        style={{ backgroundColor: (tx.profile as any).avatar_color || '#6366F1', fontSize: '10px' }}
                      >
                        {(tx.profile as any).name?.split(' ')[0]}
                      </span>
                    </>
                  )}
                </p>
              </div>

              {/* Status + valor */}
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-semibold font-mono-nums ${tx.type === 'receita' ? 'text-emerald-600' : 'text-red-500'}`}>
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
