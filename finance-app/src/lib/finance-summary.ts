import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'
import type { Bank, Transaction } from '@/types'

export type MonthProjection = {
  income: number
  realizedIncome: number
  plannedIncome: number
  directExpenses: number
  realizedDirectExpenses: number
  plannedDirectExpenses: number
  cardInvoice: number
  result: number
}

export const isCoupleTransaction = (tx: Transaction) => (tx.responsible_party || 'casal') === 'casal'
export const affectsHouseholdCash = (tx: Transaction) => tx.affects_household_cash !== false

export function calculateMonthProjection(transactions: Transaction[], banks: Bank[], targetMonth: Date): MonthProjection {
  const bankById = new Map(banks.map(bank => [bank.id, bank]))
  const monthStart = format(startOfMonth(targetMonth), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(targetMonth), 'yyyy-MM-dd')
  const coupleTransactions = transactions.filter(isCoupleTransaction)
  const cashRows = coupleTransactions.filter(tx => {
    const bank = bankById.get(tx.bank_id || '')
    return bank?.type !== 'credito'
      && affectsHouseholdCash(tx)
      && tx.date >= monthStart
      && tx.date <= monthEnd
  })
  const cardRows = coupleTransactions.filter(tx => {
    const bank = bankById.get(tx.bank_id || '')
    return bank?.type === 'credito'
      && tx.type !== 'receita'
      && tx.status === 'realizado'
      && isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), targetMonth)
  })
  const realizedIncome = cashRows.filter(tx => tx.type === 'receita' && tx.status === 'realizado')
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const plannedIncome = cashRows.filter(tx => tx.type === 'receita' && tx.status !== 'realizado')
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const realizedDirectExpenses = cashRows.filter(tx => tx.type !== 'receita' && tx.status === 'realizado')
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const plannedDirectExpenses = cashRows.filter(tx => tx.type !== 'receita' && tx.status !== 'realizado')
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const cardInvoice = cardRows.reduce((sum, tx) => sum + Number(tx.amount), 0)
  const income = realizedIncome + plannedIncome
  const directExpenses = realizedDirectExpenses + plannedDirectExpenses

  return {
    income,
    realizedIncome,
    plannedIncome,
    directExpenses,
    realizedDirectExpenses,
    plannedDirectExpenses,
    cardInvoice,
    result: income - directExpenses - cardInvoice,
  }
}

export function calculateAccumulatedCashForecast(
  transactions: Transaction[],
  banks: Bank[],
  targetMonth: Date,
  baseMonth = new Date(),
) {
  const cashBalance = banks
    .filter(bank => bank.type !== 'credito')
    .reduce((sum, bank) => sum + Number(bank.current_balance || 0), 0)
  const normalizedBase = startOfMonth(baseMonth)
  const normalizedTarget = startOfMonth(targetMonth)

  if (normalizedTarget < normalizedBase) {
    return { cashBalance, projectedCashBalance: cashBalance, accumulatedResult: 0 }
  }

  let cursor = normalizedBase
  let accumulatedResult = 0
  while (cursor <= normalizedTarget) {
    accumulatedResult += calculateMonthProjection(transactions, banks, cursor).result
    cursor = addMonths(cursor, 1)
  }

  return {
    cashBalance,
    accumulatedResult,
    projectedCashBalance: cashBalance + accumulatedResult,
  }
}
