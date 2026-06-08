import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns'
import { getCreditCardPaymentDate, isDateInMonth } from '@/lib/finance-dates'
import type { Bank, Transaction } from '@/types'

export type MonthProjection = {
  income: number
  operationalIncome: number
  reimbursementIncome: number
  realizedOperationalIncome: number
  plannedOperationalIncome: number
  realizedReimbursementIncome: number
  plannedReimbursementIncome: number
  realizedIncome: number
  plannedIncome: number
  directExpenses: number
  grossDirectExpenses: number
  neusaSharedDirectExpenses: number
  realizedDirectExpenses: number
  plannedDirectExpenses: number
  cardInvoice: number
  grossCardInvoice: number
  neusaSharedCardInvoice: number
  householdResult: number
  cashResult: number
  result: number
}

export const isCoupleTransaction = (tx: Transaction) => (tx.responsible_party || 'casal') === 'casal'
export const affectsHouseholdCash = (tx: Transaction) => tx.affects_household_cash !== false
export const isNeusaTransaction = (tx: Transaction) => tx.responsible_party === 'sogra'
export const isNeusaReimbursement = (tx: Transaction) => tx.type === 'receita' && tx.is_neusa_reimbursement === true
export const getEffectiveCashDate = (tx: Transaction) => tx.status === 'realizado' ? (tx.settled_at || tx.date) : tx.date
export const getNeusaShareAmount = (tx: Transaction) => Math.max(0, Math.min(Number(tx.neusa_share_amount || 0), Number(tx.amount || 0)))
export const getHouseholdNetAmount = (tx: Transaction) => Math.max(0, Number(tx.amount || 0) - getNeusaShareAmount(tx))

export function calculateMonthProjection(transactions: Transaction[], banks: Bank[], targetMonth: Date): MonthProjection {
  const bankById = new Map(banks.map(bank => [bank.id, bank]))
  const monthStart = format(startOfMonth(targetMonth), 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(targetMonth), 'yyyy-MM-dd')
  const cashRows = transactions.filter(tx => {
    const bank = bankById.get(tx.bank_id || '')
    const monthDate = getEffectiveCashDate(tx)
    return bank?.type !== 'credito'
      && affectsHouseholdCash(tx)
      && monthDate >= monthStart
      && monthDate <= monthEnd
  })
  const cardRows = transactions.filter(tx => {
    const bank = bankById.get(tx.bank_id || '')
    return bank?.type === 'credito'
      && tx.type !== 'receita'
      && tx.status === 'realizado'
      && isDateInMonth(getCreditCardPaymentDate(tx.date, bank.due_day, bank.closing_day), targetMonth)
  })
  const realizedOperationalIncome = cashRows.filter(tx => tx.type === 'receita' && tx.status === 'realizado' && !isNeusaReimbursement(tx))
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const plannedOperationalIncome = cashRows.filter(tx => tx.type === 'receita' && tx.status !== 'realizado' && !isNeusaReimbursement(tx))
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const realizedReimbursementIncome = cashRows.filter(tx => tx.type === 'receita' && tx.status === 'realizado' && isNeusaReimbursement(tx))
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const plannedReimbursementIncome = cashRows.filter(tx => tx.type === 'receita' && tx.status !== 'realizado' && isNeusaReimbursement(tx))
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const coupleCashExpenses = cashRows.filter(tx => tx.type !== 'receita' && isCoupleTransaction(tx))
  const realizedDirectExpenses = coupleCashExpenses.filter(tx => tx.status === 'realizado')
    .reduce((sum, tx) => sum + getHouseholdNetAmount(tx), 0)
  const plannedDirectExpenses = coupleCashExpenses.filter(tx => tx.status !== 'realizado')
    .reduce((sum, tx) => sum + getHouseholdNetAmount(tx), 0)
  const grossDirectExpenses = cashRows.filter(tx => tx.type !== 'receita')
    .reduce((sum, tx) => sum + Number(tx.amount), 0)
  const neusaSharedDirectExpenses = coupleCashExpenses
    .reduce((sum, tx) => sum + getNeusaShareAmount(tx), 0)
  const coupleCardRows = cardRows.filter(isCoupleTransaction)
  const grossCardInvoice = cardRows.reduce((sum, tx) => sum + Number(tx.amount), 0)
  const cardInvoice = coupleCardRows.reduce((sum, tx) => sum + getHouseholdNetAmount(tx), 0)
  const neusaSharedCardInvoice = coupleCardRows.reduce((sum, tx) => sum + getNeusaShareAmount(tx), 0)
  const operationalIncome = realizedOperationalIncome + plannedOperationalIncome
  const reimbursementIncome = realizedReimbursementIncome + plannedReimbursementIncome
  const income = operationalIncome + reimbursementIncome
  const directExpenses = realizedDirectExpenses + plannedDirectExpenses
  const householdResult = operationalIncome - directExpenses - cardInvoice
  const cashResult = income - grossDirectExpenses - grossCardInvoice

  return {
    income,
    operationalIncome,
    reimbursementIncome,
    realizedOperationalIncome,
    plannedOperationalIncome,
    realizedReimbursementIncome,
    plannedReimbursementIncome,
    realizedIncome: realizedOperationalIncome + realizedReimbursementIncome,
    plannedIncome: plannedOperationalIncome + plannedReimbursementIncome,
    directExpenses,
    grossDirectExpenses,
    neusaSharedDirectExpenses,
    realizedDirectExpenses,
    plannedDirectExpenses,
    cardInvoice,
    grossCardInvoice,
    neusaSharedCardInvoice,
    householdResult,
    cashResult,
    result: cashResult,
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
